"use server"

import { sdk } from "@/lib/config"
import medusaError from "@/lib/util/medusa-error"
import { B2BCustomer } from "@/types/global"
import { StoreBenefitBudget } from "@/types/benefit-budget"
import { HttpTypes } from "@medusajs/types"
import { track } from "@vercel/analytics/server"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { retrieveCart, updateCart } from "./cart"
import { checkNewPassword } from "@/lib/util/password-policy"
import { sessionClosedUrl } from "@/lib/util/session"
import { forwardedForHeaders } from "@/lib/util/forwarded-for"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeAuthToken,
  removeCartId,
  setAuthToken,
} from "./cookies"

export const retrieveCustomer = async (): Promise<B2BCustomer | null> => {
  const authHeaders = await getAuthHeaders()

  if (!authHeaders) return null

  const headers = {
    ...authHeaders,
  }

  const next = {
    ...(await getCacheOptions("customers")),
  }

  // El saldo de beneficio va sin caché (no-store): cambia con cada pedido y
  // también cuando el Admin anula uno o fija una excepción de tope, y esos
  // cambios no pasan por este storefront para revalidar el tag.
  const [customer, benefitBudget] = await Promise.all([
    sdk.client
      .fetch<{ customer: B2BCustomer }>(`/store/customers/me`, {
        method: "GET",
        query: {
          fields: "*employee, *orders",
        },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ customer }) => customer as B2BCustomer)
      .catch(() => null),
    retrieveBenefitBudget(),
  ])

  if (!customer) return null

  return { ...customer, benefit_budget: benefitBudget }
}

// Saldo de beneficio del colaborador logueado en el periodo vigente.
// null si no hay sesión, no hay campaña activa o falla la consulta.
export const retrieveBenefitBudget =
  async (): Promise<StoreBenefitBudget | null> => {
    const authHeaders = await getAuthHeaders()

    if (!authHeaders) return null

    return await sdk.client
      .fetch<{ benefit_budget: StoreBenefitBudget | null }>(
        `/store/benefit-budget`,
        {
          method: "GET",
          headers: { ...authHeaders },
          cache: "no-store",
        }
      )
      .then(({ benefit_budget }) => benefit_budget)
      .catch(() => null)
  }

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(medusaError)

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag)

  return updateRes
}

// Evita open redirects: solo se sigue una ruta interna que empiece con "/"
// (y no "//", que el navegador puede interpretar como otro host).
function getSafeRedirect(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value) return null
  if (!value.startsWith("/") || value.startsWith("//")) return null
  if (value.includes("://")) return null
  return value
}

/*

Estado de la cuenta del colaborador logueado (rut-auth, pasos 6 y 9). El
backend es la única fuente de verdad: `GET /store/customers/me/password` lee
la identidad `rut`. Sin caché, porque cambia apenas el colaborador cambia la
clave o un admin lo deshabilita.

- "ok":                    puede usar la tienda.
- "must_change_password":  debe cambiar la clave inicial (/cambiar-clave).
- "disabled":              un admin deshabilitó la cuenta: hay que cerrar la
                           sesión (el backend ya responde 401 a todo).
- null:                    sin sesión o no se pudo consultar (quien llama
                           decide; los layouts no redirigen en ese caso).

*/
export type AccountState = "ok" | "must_change_password" | "disabled"

// Mensaje del 401 de backend/src/api/middlewares/account-state.ts. El SDK no
// expone el `code` del body, así que se reconoce por el mensaje.
const ACCOUNT_DISABLED_API_MESSAGE = "Tu cuenta está deshabilitada."

export const retrieveAccountState = async (): Promise<AccountState | null> => {
  const authHeaders = await getAuthHeaders()

  if (!("authorization" in authHeaders)) return null

  return await sdk.client
    .fetch<{ must_change_password: boolean }>(`/store/customers/me/password`, {
      method: "GET",
      headers: { ...authHeaders },
      cache: "no-store",
    })
    .then(({ must_change_password }): AccountState =>
      must_change_password === true ? "must_change_password" : "ok"
    )
    .catch((error: any): AccountState | null =>
      error?.status === 401 && error?.message === ACCOUNT_DISABLED_API_MESSAGE
        ? "disabled"
        : null
    )
}

/** true si debe cambiar la clave inicial; null si no se sabe. */
export const retrievePasswordChangeRequired = async (): Promise<
  boolean | null
> => {
  const state = await retrieveAccountState()
  return state === null ? null : state === "must_change_password"
}

/**
 * Para los layouts de la tienda y el checkout:
 * - cuenta deshabilitada → cierra la sesión (route handler /api/sesion-cerrada:
 *   un layout no puede borrar cookies) y vuelve al login con un aviso;
 * - clave inicial sin cambiar → /cambiar-clave.
 * El backend igual bloquea la Store API; esto evita que el colaborador vea
 * páginas a medio cargar.
 */
export const enforceAccountState = async (countryCode: string) => {
  const state = await retrieveAccountState()

  if (state === "disabled") {
    redirect(sessionClosedUrl(countryCode))
  }

  if (state === "must_change_password") {
    redirect(`/${countryCode}/cambiar-clave`)
  }
}

const INVALID_CREDENTIALS = "RUT o clave incorrectos"
const ACCOUNT_DISABLED_LOGIN_MESSAGE =
  "Tu cuenta está deshabilitada. Contacta a tu administrador."

// El backend no dice si la cuenta está bloqueada (sería revelar que el RUT
// existe): el aviso va siempre, junto al mensaje de credenciales. Los números
// son los de LOCKOUT en backend/src/modules/rut-auth/config.ts.
const INVALID_CREDENTIALS_HELP = `${INVALID_CREDENTIALS}. Después de 5 intentos fallidos, la cuenta se bloquea por 15 minutos.`

export async function login(_currentState: unknown, formData: FormData) {
  const rut = formData.get("rut") as string
  const password = formData.get("password") as string
  const countryCode = (formData.get("country_code") as string) || "cl"

  let mustChangePassword = false

  try {
    // Mismo endpoint que sdk.auth.login, pero con la IP del colaborador
    // (auditoría, paso 10): sdk.auth.login no acepta headers.
    const { token } = await sdk.client.fetch<{ token?: string }>(
      "/auth/customer/rut",
      {
        method: "POST",
        body: { rut, password },
        headers: await forwardedForHeaders(),
      }
    )

    if (!token) {
      throw new Error("Unexpected authentication response")
    }

    track("customer_logged_in")
    await setAuthToken(token as string)

    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)

    // Primer ingreso (o clave reseteada): antes de cualquier otra cosa hay
    // que cambiar la clave. El backend bloquea el carrito hasta entonces, así
    // que no se toca.
    mustChangePassword = (await retrievePasswordChangeRequired()) === true

    if (!mustChangePassword) {
      const [productsCacheTag, cartsCacheTag] = await Promise.all([
        getCacheTag("products"),
        getCacheTag("carts"),
      ])

      const customer = await retrieveCustomer()
      const cart = await retrieveCart()

      // Solo si ya hay un carrito (anónimo, de antes de iniciar sesión):
      // updateCart lanza error sin carrito, y eso mostraba "No pudimos
      // iniciar tu sesión" aunque el login hubiera funcionado (y no se
      // seguía el redirect_to).
      if (cart && customer?.employee?.company_id) {
        await updateCart({
          metadata: {
            ...cart?.metadata,
            company_id: customer.employee.company_id,
          },
        })
      }

      revalidateTag(productsCacheTag)
      revalidateTag(cartsCacheTag)
    }
  } catch (error: any) {
    // El backend responde el mismo mensaje para RUT inexistente, RUT
    // inválido y clave incorrecta (sin enumeración de cuentas). No se
    // muestra el error crudo: cualquier otra falla (backend caído, red)
    // muestra un mensaje genérico.
    const rawMessage = (error?.message ?? error?.toString() ?? "").toLowerCase()

    if (rawMessage.includes(INVALID_CREDENTIALS.toLowerCase())) {
      return INVALID_CREDENTIALS_HELP
    }

    // Cuenta deshabilitada: el backend solo lo dice si la clave es correcta
    // (sin la clave no se distingue de un RUT inexistente).
    if (rawMessage.includes("deshabilitada")) {
      return ACCOUNT_DISABLED_LOGIN_MESSAGE
    }

    return "No pudimos iniciar tu sesión. Intenta nuevamente en unos minutos."
  }

  // Fuera de los try/catch: redirect() lanza NEXT_REDIRECT y no debe
  // capturarse como si fuera un error de login.
  if (mustChangePassword) {
    redirect(`/${countryCode}/cambiar-clave`)
  }

  try {
    await transferCart()
  } catch (error: any) {
    return error.toString()
  }

  // Si el middleware nos mandó acá por falta de sesión (home o catálogo
  // protegidos), volvemos a la página que se quería visitar.
  const redirectTo = getSafeRedirect(formData.get("redirect_to"))

  if (redirectTo) {
    redirect(redirectTo)
  }
}

// Estado que devuelven `requestPasswordReset` y `resetPassword` a
// `useActionState`. A diferencia de `login` (que en éxito hace
// `redirect()` y no necesita distinguir "éxito" de "sin enviar todavía"),
// acá el éxito se muestra como un mensaje inline en la misma vista, así
// que hace falta una bandera `success` explícita en vez de solo un string
// de error.
export type PasswordResetActionState = {
  error?: string
  success?: boolean
}

/*

"Olvidé mi contraseña" (rut-auth, paso 8).

Paso 1 — `requestPasswordReset`: pide el reset con el RUT
(`POST /auth/customer/rut/reset-password`, vía el SDK). El backend
normaliza el RUT, busca el correo del colaborador y le manda el enlace
(backend/src/subscribers/customer-password-reset.ts; en desarrollo, el
enlace sale destacado en la consola del backend). El endpoint SIEMPRE
responde 201, exista o no la cuenta, así que acá tampoco se distingue: se
muestra el mismo mensaje. Un error acá es una falla de red o del backend.

Paso 2 — `resetPassword`: define la clave nueva con el token del enlace
(`POST /auth/customer/rut/update`, token como Bearer). El token vence en 15
minutos (fijo en el core de Medusa) y es de un solo uso: el core lo
consume ANTES de revisar la clave. Por eso la política se revisa primero
acá (lib/util/password-policy.ts, copia de la del backend): si la clave no
cumple, el colaborador la corrige sin perder el enlace.

*/
export async function requestPasswordReset(
  _currentState: PasswordResetActionState,
  formData: FormData
): Promise<PasswordResetActionState> {
  const rut = formData.get("rut") as string

  try {
    // Equivale a sdk.auth.resetPassword, más la IP del colaborador.
    await sdk.client.fetch("/auth/customer/rut/reset-password", {
      method: "POST",
      body: { identifier: rut },
      headers: { accept: "text/plain", ...(await forwardedForHeaders()) },
    })
  } catch (error: any) {
    return {
      error:
        "No pudimos procesar tu solicitud. Intenta nuevamente en unos minutos.",
    }
  }

  return { success: true }
}

const INVALID_RESET_LINK =
  'El link expiró o no es válido. Solicita uno nuevo desde "¿Olvidaste la contraseña?".'

/** RUT (entity_id) del token de recuperación, sin verificar la firma. */
function rutFromResetToken(token: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")
    )
    return typeof payload?.entity_id === "string" ? payload.entity_id : null
  } catch {
    return null
  }
}

export async function resetPassword(
  _currentState: PasswordResetActionState,
  formData: FormData
): Promise<PasswordResetActionState> {
  const token = formData.get("token") as string
  const password = formData.get("password") as string
  const repeatPassword = formData.get("repeat_password") as string

  if (!token) {
    return {
      error:
        'Este link no es válido. Solicita uno nuevo desde "¿Olvidaste la contraseña?".',
    }
  }

  if (password !== repeatPassword) {
    return { error: "Las contraseñas no coinciden." }
  }

  // Antes de gastar el enlace: ¿la clave cumple la política? Si el token no
  // se puede leer, decide el backend (y responderá "link no válido").
  const rut = rutFromResetToken(token)
  const policyError = rut ? checkNewPassword(rut, password) : null

  if (policyError) {
    return { error: policyError }
  }

  try {
    // Equivale a sdk.auth.updateProvider, más la IP del colaborador.
    await sdk.client.fetch("/auth/customer/rut/update", {
      method: "POST",
      body: { password },
      headers: {
        Authorization: `Bearer ${token}`,
        ...(await forwardedForHeaders()),
      },
    })
  } catch (error: any) {
    return { error: INVALID_RESET_LINK }
  }

  return { success: true }
}

export type ChangePasswordResult = {
  error?: string
  /** Campo del formulario donde mostrar el error. */
  field?: "current_password" | "password"
  success?: boolean
}

/*

Cambio de clave del colaborador logueado: el obligatorio del primer ingreso
(/cambiar-clave) y el voluntario desde el perfil. Ambos van a
`POST /store/customers/me/password` (backend), que:

- verifica la clave actual en el servidor (antes lo hacía este archivo con
  un login aparte),
- aplica la política de clave (largo, sin números del RUT) y
- toma el RUT de la sesión, nunca del body.

Los mensajes de error del backend ya vienen en español y se muestran tal
cual; el `code` decide en qué campo.

*/
export async function changePassword({
  currentPassword,
  newPassword,
}: {
  currentPassword: string
  newPassword: string
}): Promise<ChangePasswordResult> {
  const headers = {
    ...(await getAuthHeaders()),
    ...(await forwardedForHeaders()),
  }

  try {
    await sdk.client.fetch("/store/customers/me/password", {
      method: "POST",
      body: { current_password: currentPassword, password: newPassword },
      headers,
    })
  } catch (error: any) {
    const status = error?.status
    const message: string | undefined = error?.message

    if (status === 400 && message) {
      // El SDK no expone el `code` del body: se distingue por el mensaje
      // (ver backend/src/api/store/customers/me/password/route.ts).
      const aboutCurrent =
        message.startsWith("La clave actual") ||
        message.startsWith("Ingresa tu clave actual")
      return {
        error: message,
        field: aboutCurrent ? "current_password" : "password",
      }
    }

    if (status === 401) {
      return { error: "Tu sesión expiró. Vuelve a iniciar sesión." }
    }

    // Corre en el servidor de Next.js (Server Action): el detalle solo se ve
    // en la terminal del storefront, no en el navegador.
    console.error(
      "[changePassword] falló POST /store/customers/me/password:",
      "status:",
      status,
      "message:",
      message
    )
    return { error: "No pudimos actualizar la contraseña. Intenta nuevamente." }
  }

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag)

  return { success: true }
}

/**
 * Server action de /cambiar-clave (cambio obligatorio del primer ingreso).
 * En éxito deja seguir a la tienda: traspasa el carrito anónimo, si había, y
 * redirige al inicio.
 */
export async function forcedChangePassword(
  _currentState: ChangePasswordResult,
  formData: FormData
): Promise<ChangePasswordResult> {
  const countryCode = (formData.get("country_code") as string) || "cl"

  const result = await changePassword({
    currentPassword: formData.get("current_password") as string,
    newPassword: formData.get("password") as string,
  })

  if (!result.success) {
    return result
  }

  try {
    await transferCart()
  } catch {
    // Sin carrito anónimo que traspasar: no es un error para el colaborador.
  }

  redirect(`/${countryCode}`)
}

export async function signout(countryCode: string, customerId: string) {
  await sdk.auth.logout()
  removeAuthToken()
  track("customer_logged_out")

  // remove next line if want the cart to persist after logout
  await removeCartId()

  const [authCacheTag, customerCacheTag, productsCacheTag, cartsCacheTag] =
    await Promise.all([
      getCacheTag("auth"),
      getCacheTag("customers"),
      getCacheTag("products"),
      getCacheTag("carts"),
    ])

  revalidateTag(authCacheTag)
  revalidateTag(customerCacheTag)
  revalidateTag(productsCacheTag)
  revalidateTag(cartsCacheTag)

  redirect(`/${countryCode}/account`)
}

export async function transferCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart.transferCart(cartId, {}, headers)

  const cartCacheTag = await getCacheTag("carts")

  revalidateTag(cartCacheTag)
}

export const addCustomerAddress = async (
  _currentState: unknown,
  formData: FormData
): Promise<any> => {
  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .createAddress(address, {}, headers)
    .then(async () => {
      const cacheTag = await getCacheTag("customers")
      revalidateTag(cacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const deleteCustomerAddress = async (
  addressId: string
): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const cacheTag = await getCacheTag("customers")
      revalidateTag(cacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const addressId = currentState.addressId as string

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const cacheTag = await getCacheTag("customers")
      revalidateTag(cacheTag)
      // Se devuelve `addressId` en el nuevo estado: `useActionState` pasa
      // este objeto como `currentState` en el siguiente envío, y sin él un
      // segundo "Guardar" en el mismo modal perdía el id de la dirección.
      return { success: true, error: null, addressId }
    })
    .catch((err) => {
      return { success: false, error: err.toString(), addressId }
    })
}
