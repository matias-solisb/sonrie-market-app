"use server"

import { sdk } from "@/lib/config"
import medusaError from "@/lib/util/medusa-error"
import { B2BCustomer } from "@/types/global"
import { HttpTypes } from "@medusajs/types"
import { track } from "@vercel/analytics/server"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { retrieveCart, updateCart } from "./cart"
import { createCompany, createEmployee } from "./companies"
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

  return await sdk.client
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

export async function signup(_currentState: unknown, formData: FormData) {
  const password = formData.get("password") as string
  const customerForm = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: formData.get("phone") as string,
    company_name: formData.get("company_name") as string,
  }

  try {
    const token = await sdk.auth.register("customer", "emailpass", {
      email: customerForm.email,
      password: password,
    })

    const customHeaders = { authorization: `Bearer ${token}` }

    const { customer: createdCustomer } = await sdk.store.customer.create(
      customerForm,
      {},
      customHeaders
    )

    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email: customerForm.email,
      password,
    })

    setAuthToken(loginToken as string)

    const companyForm = {
      name: formData.get("company_name") as string,
      email: formData.get("email") as string,
      phone: formData.get("company_phone") as string,
      address: formData.get("company_address") as string,
      city: formData.get("company_city") as string,
      state: formData.get("company_state") as string,
      zip: formData.get("company_zip") as string,
      country: formData.get("company_country") as string,
      currency_code: formData.get("currency_code") as string,
    }

    const createdCompany = await createCompany(companyForm)

    const createdEmployee = await createEmployee({
      company_id: createdCompany?.id as string,
      customer_id: createdCustomer.id,
      is_admin: true,
      spending_limit: 0,
    }).catch((err) => {
      console.log("error creating employee", err)
    })

    const cacheTag = await getCacheTag("customers")
    revalidateTag(cacheTag)

    await transferCart()

    return {
      customer: createdCustomer,
      company: createdCompany,
      employee: createdEmployee,
    }
  } catch (error: any) {
    console.log("error", error)
    return error.toString()
  }
}

// Evita open redirects: solo se sigue una ruta interna que empiece con "/"
// (y no "//", que el navegador puede interpretar como otro host).
function getSafeRedirect(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value) return null
  if (!value.startsWith("/") || value.startsWith("//")) return null
  if (value.includes("://")) return null
  return value
}

export async function login(_currentState: unknown, formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  try {
    await sdk.auth
      .login("customer", "emailpass", { email, password })
      .then(async (token) => {
        track("customer_logged_in")
        setAuthToken(token as string)

        const [customerCacheTag, productsCacheTag, cartsCacheTag] =
          await Promise.all([
            getCacheTag("customers"),
            getCacheTag("products"),
            getCacheTag("carts"),
          ])

        revalidateTag(customerCacheTag)

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
      })
  } catch (error: any) {
    // No mostramos el MedusaError crudo ("MedusaError: Invalid email or
    // password") en pantalla: es texto interno en inglés. Si es un error de
    // credenciales lo traducimos a un mensaje claro; cualquier otra falla
    // (backend caído, red, etc.) muestra un mensaje genérico.
    const rawMessage = (error?.message ?? error?.toString() ?? "").toLowerCase()

    if (rawMessage.includes("invalid email or password")) {
      return "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo."
    }

    return "No pudimos iniciar tu sesión. Intenta nuevamente en unos minutos."
  }

  try {
    await transferCart()
  } catch (error: any) {
    return error.toString()
  }

  // Si el middleware nos mandó acá por falta de sesión (home o catálogo
  // protegidos), volvemos a la página que se quería visitar. Va fuera de
  // los try/catch de arriba: redirect() lanza NEXT_REDIRECT y no debe ser
  // capturado como si fuera un error de login.
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

// Cambio de contraseña desde la cuenta ya logueada (ProfileCard). A
// diferencia del flujo de "Olvidé mi contraseña", acá no hay token de
// email: el usuario ya tiene sesión.
//
// Paso 1 — verificar la "contraseña actual": el endpoint de Medusa para
// actualizar contraseña (`EmailPassAuthService.update()`) NO verifica la
// contraseña actual por sí solo, así que la verificamos nosotros acá
// mismo, haciendo un login real con el email de la cuenta + la
// contraseña "actual" ingresada. Si ese login falla, la contraseña
// actual está mal.
//
// Paso 2 — aplicar la contraseña nueva: NO se puede reusar el token que
// devuelve ese login de verificación contra el endpoint nativo
// `POST /auth/customer/emailpass/update` — ese endpoint exige un JWT con
// un claim `entity_id` que solo trae el token especial del flujo de
// "olvidé mi contraseña"; un token normal de sesión/login (`actor_id` +
// `app_metadata`) SIEMPRE lo rechaza con "Invalid token", confirmado
// leyendo el código fuente de Medusa. Por eso se llama en cambio a una
// ruta propia del backend (`POST /store/customers/me/password`, ver
// `backend/src/api/store/customers/me/password/route.ts`), protegida
// por el middleware estándar de sesión — ahí sí se puede aplicar la
// contraseña nueva usando la sesión actual del usuario (`getAuthHeaders`),
// sin depender del token de verificación del paso 1.
export async function changePassword({
  currentPassword,
  newPassword,
}: {
  currentPassword: string
  newPassword: string
}): Promise<PasswordResetActionState> {
  const customer = await retrieveCustomer()

  if (!customer?.email) {
    return {
      error: "No pudimos identificar tu cuenta. Vuelve a iniciar sesión.",
    }
  }

  try {
    await sdk.auth.login("customer", "emailpass", {
      email: customer.email,
      password: currentPassword,
    })
  } catch (error: any) {
    return { error: "La contraseña actual no es correcta." }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  try {
    await sdk.client.fetch("/store/customers/me/password", {
      method: "POST",
      body: { password: newPassword },
      headers,
    })
  } catch (error: any) {
    // Este llamado corre en el servidor de Next.js (es un Server Action),
    // así que su resultado NUNCA aparece en la pestaña Network del
    // navegador — esa pestaña solo ve el POST del navegador hacia el
    // propio Next.js (aparece con el nombre de la página, p. ej.
    // "profile"), no la llamada de Next.js hacia el backend de Medusa.
    // Por eso se loggea acá el detalle real (status + body del error de
    // Medusa): para verlo hay que mirar la terminal donde corre
    // `npm run dev` del storefront, no la consola del navegador.
    console.error(
      "[changePassword] falló POST /store/customers/me/password:",
      "status:",
      error?.status,
      "message:",
      error?.message,
      "body:",
      error?.body ?? error
    )
    return {
      error: "No pudimos actualizar la contraseña. Intenta nuevamente.",
    }
  }

  return { success: true }
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
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}
