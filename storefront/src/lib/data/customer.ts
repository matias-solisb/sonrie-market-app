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

Estado del cambio de clave obligatorio (rut-auth, paso 6). El backend es la
única fuente de verdad: `GET /store/customers/me/password` lee la identidad
`rut` del colaborador. Sin caché, porque cambia apenas el colaborador
cambia la clave.

- true:  debe cambiar la clave antes de usar la tienda.
- false: puede usar la tienda.
- null:  sin sesión o no se pudo consultar (se trata como "no sé": quien
         llama decide; los layouts no redirigen en ese caso).

*/
export const retrievePasswordChangeRequired = async (): Promise<
  boolean | null
> => {
  const authHeaders = await getAuthHeaders()

  if (!("authorization" in authHeaders)) return null

  return await sdk.client
    .fetch<{ must_change_password: boolean }>(`/store/customers/me/password`, {
      method: "GET",
      headers: { ...authHeaders },
      cache: "no-store",
    })
    .then(({ must_change_password }) => must_change_password === true)
    .catch(() => null)
}

/**
 * Para los layouts de la tienda y el checkout: si el colaborador logueado
 * todavía no cambia la clave inicial, lo manda a /cambiar-clave. El backend
 * igual bloquea la Store API (403 password_change_required); esto evita que
 * vea páginas a medio cargar.
 */
export const redirectIfPasswordChangeRequired = async (countryCode: string) => {
  if ((await retrievePasswordChangeRequired()) === true) {
    redirect(`/${countryCode}/cambiar-clave`)
  }
}

const INVALID_CREDENTIALS = "RUT o clave incorrectos"

export async function login(_currentState: unknown, formData: FormData) {
  const rut = formData.get("rut") as string
  const password = formData.get("password") as string
  const countryCode = (formData.get("country_code") as string) || "cl"

  let mustChangePassword = false

  try {
    const token = await sdk.auth.login("customer", "rut", { rut, password })

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

      if (customer?.employee?.company_id) {
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
      return INVALID_CREDENTIALS
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

// ⚠️ "Olvidé mi contraseña" (requestPasswordReset / resetPassword) sigue
// con emailpass: se migra a RUT en el paso 8 de rut-auth (recuperación por
// correo). Mientras tanto no le sirve a ningún colaborador, porque ya no
// tienen identidad emailpass.
//
// Paso 1 del flujo "Olvidé mi contraseña": pide el reset a Medusa
// (`POST /auth/customer/emailpass/reset-password`, vía el SDK). Ese
// endpoint SIEMPRE responde 201 aunque el email no exista en el sistema
// — es a propósito, para no filtrar qué correos están registrados — así
// que folosotros tampoco distinguimos ese caso acá: se muestra el mismo
// mensaje de éxito exista o no la cuenta. Un error acá es de verdad una
// falla de red/backend, no "el correo no existe".
//
// Quien realmente entrega el correo es el subscriber del backend
// (`backend/src/subscribers/customer-password-reset.ts`), que hoy solo
// loggea el link en la consola del backend (provider `local`, ver
// `medusa-config.ts`) — no hay ningún servicio de correo real conectado
// todavía.
export async function requestPasswordReset(
  _currentState: PasswordResetActionState,
  formData: FormData
): Promise<PasswordResetActionState> {
  const email = formData.get("email") as string

  try {
    await sdk.auth.resetPassword("customer", "emailpass", {
      identifier: email,
    })
  } catch (error: any) {
    return {
      error: "No pudimos procesar tu solicitud. Intenta nuevamente en unos minutos.",
    }
  }

  return { success: true }
}

// Paso 2: pone la contraseña nueva usando el token que llegó en la URL
// del correo (ver `resetUrl` en el subscriber del backend). El endpoint
// (`POST /auth/customer/emailpass/update`) valida el token como un
// Authorization Bearer — si venció (dura 15 minutos, fijo en el core de
// Medusa) o es inválido, tira un error genérico de "Unauthorized" que acá
// se traduce a un mensaje que le sirve al usuario para reintentar.
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
        "Este link no es válido. Solicita uno nuevo desde \"¿Olvidaste la contraseña?\".",
    }
  }

  if (password !== repeatPassword) {
    return { error: "Las contraseñas no coinciden." }
  }

  try {
    await sdk.auth.updateProvider(
      "customer",
      "emailpass",
      { password },
      token
    )
  } catch (error: any) {
    return {
      error:
        "El link expiró o no es válido. Solicita uno nuevo desde \"¿Olvidaste la contraseña?\".",
    }
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
