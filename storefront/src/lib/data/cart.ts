"use server"

import { sdk } from "@/lib/config"
import medusaError from "@/lib/util/medusa-error"
import { userErrorMessage } from "@/lib/util/translate-medusa-error"
import { StoreApprovalResponse } from "@/types/approval"
import { HttpTypes } from "@medusajs/types"
import { track } from "@vercel/analytics/server"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { B2BCart } from "@/types/global"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeCartId,
  setCartId,
} from "./cookies"
import { retrieveCustomer } from "./customer"
import { getRegion } from "./regions"

export async function retrieveCart(id?: string) {
  const cartId = id || (await getCartId())

  if (!cartId) {
    return null
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("carts")),
  }

  return await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${cartId}`, {
      credentials: "include",
      method: "GET",
      query: {
        fields:
          "*items, *region, *items.product, *items.variant, +items.thumbnail, +items.metadata, *promotions, *company, *company.approval_settings, *customer, *approvals, +completed_at, *approval_status",
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ cart }) => {
      return cart as B2BCart
    })
    .catch(() => {
      return null
    })
}

export async function getOrSetCart(countryCode: string) {
  let cart = await retrieveCart()
  const region = await getRegion(countryCode)
  const customer = await retrieveCustomer()

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  if (!cart) {
    const body = {
      region_id: region.id,
      metadata: {
        company_id: customer?.employee?.company_id,
      },
    }

    const cartResp = await sdk.store.cart.create(body, {}, headers)

    setCartId(cartResp.cart.id)

    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)

    cart = await retrieveCart()
  }

  if (cart && cart?.region_id !== region.id) {
    await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, headers)
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  return cart
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found, please create one before updating")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }) => {
      const fullfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fullfillmentCacheTag)
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return cart
    })
    .catch(medusaError)
}

export type UnavailableCartItem = {
  variant_id: string
  title: string
  requested: number
  available: number
}

/*

Elige el site de retiro del carrito (POST /store/carts/:id/pickup-site).
El backend pasa el carrito al canal de venta del site (el stock se reserva
solo en esa sala), copia la dirección del site como envío y facturación,
completa el correo del colaborador, guarda `metadata.stock_location_id` y
agrega la opción "Retiro en {site}". Devuelve el carrito actualizado y los
ítems sin stock suficiente en ese site.

*/
export async function setCartPickupSite(stockLocationId: string): Promise<
  | { cart: B2BCart; unavailable_items: UnavailableCartItem[]; error?: never }
  | { error: string }
> {
  const cartId = await getCartId()

  if (!cartId) {
    return { error: "No encontramos tu carrito. Recarga la página e intenta de nuevo." }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<{ cart: B2BCart; unavailable_items: UnavailableCartItem[] }>(
      `/store/carts/${cartId}/pickup-site`,
      {
        method: "POST",
        headers,
        body: { stock_location_id: stockLocationId },
      }
    )
    .then(async (res) => {
      revalidateTag(await getCacheTag("fulfillment"))
      revalidateTag(await getCacheTag("carts"))
      return res
    })
    .catch((error) => ({
      error: userErrorMessage(
        error,
        "No se pudo guardar el site de retiro elegido. Intenta nuevamente."
      ),
    }))
}

/*

Guarda la fecha de retiro del carrito (POST /store/carts/:id/pickup-date,
`metadata.pickup_date`). El backend valida que el carrito tenga site y que
la fecha tenga cupo, pero no reserva el cupo: eso ocurre al confirmar el
pedido. Si se cambia el site en el carrito, el backend borra la fecha.

*/
export async function setCartPickupDate(
  fecha: string
): Promise<{ fecha: string; error?: never } | { error: string }> {
  const cartId = await getCartId()

  if (!cartId) {
    return { error: "No encontramos tu carrito. Recarga la página e intenta de nuevo." }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<{ pickup_date: { fecha: string } }>(
      `/store/carts/${cartId}/pickup-date`,
      {
        method: "POST",
        headers,
        body: { fecha },
      }
    )
    .then(async (res) => {
      revalidateTag(await getCacheTag("carts"))
      return { fecha: res.pickup_date.fecha }
    })
    .catch((error) => ({
      error: userErrorMessage(
        error,
        "No se pudo guardar la fecha de retiro. Intenta nuevamente."
      ),
    }))
}

export async function addToCart({
  variantId,
  quantity,
  countryCode,
}: {
  variantId: string
  quantity: number
  countryCode: string
}) {
  if (!variantId) {
    throw new Error("Missing variant ID when adding to cart")
  }

  const cart = await getOrSetCart(countryCode)
  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .createLineItem(
      cart.id,
      {
        variant_id: variantId,
        quantity,
      },
      {},
      headers
    )
    .then(async () => {
      const fullfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fullfillmentCacheTag)
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(medusaError)
}

export async function addToCartBulk({
  lineItems,
  countryCode,
}: {
  lineItems: HttpTypes.StoreAddCartLineItem[]
  countryCode: string
}) {
  const cart = await getOrSetCart(countryCode)

  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  const headers = {
    "Content-Type": "application/json",
    ...(await getAuthHeaders()),
  } as Record<string, any>

  if (process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) {
    headers["x-publishable-api-key"] =
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  }

  await fetch(
    `${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL}/store/carts/${cart.id}/line-items/bulk`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ line_items: lineItems }),
    }
  )
    .then(async (res) => {
      // fetch() no rechaza con 4xx/5xx: sin esto los errores (sin stock,
      // carrito en aprobación...) pasaban en silencio.
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message || res.statusText)
      }

      const fullfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fullfillmentCacheTag)
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(medusaError)
}

export async function updateLineItem({
  lineId,
  data,
}: {
  lineId: string
  data: HttpTypes.StoreUpdateCartLineItem
}) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when updating line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .updateLineItem(cartId, lineId, data, {}, headers)
    .then(async () => {
      const fullfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fullfillmentCacheTag)
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(medusaError)
}

export async function deleteLineItem(lineId: string) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when deleting line item")
  }

  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("Missing cart ID when deleting line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, headers)
    .then(async () => {
      const fullfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fullfillmentCacheTag)
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(medusaError)
}

/*

Versiones "seguras" de las acciones del carrito para usar desde
componentes cliente: en vez de lanzar devuelven `{ error }` con el mensaje
en español. En producción Next.js oculta el mensaje de los errores
lanzados por una server action, así que el colaborador vería un error
genérico en vez de la causa real (por ejemplo, falta de stock).

*/
export type CartActionResult = { error?: string }

async function toCartActionResult(
  action: () => Promise<unknown>,
  fallback: string
): Promise<CartActionResult> {
  try {
    await action()
    return {}
  } catch (error) {
    return { error: userErrorMessage(error, fallback) }
  }
}

export async function tryAddToCart(
  input: Parameters<typeof addToCart>[0]
): Promise<CartActionResult> {
  return toCartActionResult(
    () => addToCart(input),
    "No se pudo agregar el producto al carrito. Intenta nuevamente."
  )
}

export async function tryAddToCartBulk(
  input: Parameters<typeof addToCartBulk>[0]
): Promise<CartActionResult> {
  return toCartActionResult(
    () => addToCartBulk(input),
    "No se pudieron agregar los productos al carrito. Intenta nuevamente."
  )
}

export async function tryUpdateLineItem(
  input: Parameters<typeof updateLineItem>[0]
): Promise<CartActionResult> {
  return toCartActionResult(
    () => updateLineItem(input),
    "No se pudo actualizar la cantidad. Intenta nuevamente."
  )
}

export async function tryDeleteLineItem(
  lineId: string
): Promise<CartActionResult> {
  return toCartActionResult(
    () => deleteLineItem(lineId),
    "No se pudo quitar el producto del carrito. Intenta nuevamente."
  )
}

export async function emptyCart() {
  const cart = await retrieveCart()
  if (!cart) {
    throw new Error("No existing cart found when emptying cart")
  }

  for (const item of cart.items || []) {
    await deleteLineItem(item.id)
  }

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}

export async function setShippingMethod({
  cartId,
  shippingMethodId,
}: {
  cartId: string
  shippingMethodId: string
}) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .addShippingMethod(cartId, { option_id: shippingMethodId }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(medusaError)
}

export async function initiatePaymentSession(
  cart: B2BCart,
  data: {
    provider_id: string
    context?: Record<string, unknown>
  }
) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.payment
    .initiatePaymentSession(cart, data, {}, headers)
    .then(async (resp) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return resp
    })
    .catch(medusaError)
}

export async function applyPromotions(codes: string[]) {
  const cartId = await getCartId()
  if (!cartId) {
    throw new Error("No existing cart found")
  }

  await updateCart({ promo_codes: codes })
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      const fullfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fullfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function applyGiftCard(code: string) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, { gift_cards: [{ code }] }).then(() => {
  //       revalidateTag(getCacheTag("carts"))
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function removeDiscount(code: string) {
  // const cartId = getCartId()
  // if (!cartId) return "No cartId cookie found"
  // try {
  //   await deleteDiscount(cartId, code)
  //   revalidateTag(getCacheTag("carts"))
  // } catch (error: any) {
  //   throw error
  // }
}

export async function removeGiftCard(
  codeToRemove: string,
  giftCards: any[]
  // giftCards: GiftCard[]
) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, {
  //       gift_cards: [...giftCards]
  //         .filter((gc) => gc.code !== codeToRemove)
  //         .map((gc) => ({ code: gc.code })),
  //     }).then(() => {
  //       revalidateTag(getCacheTag("carts"))
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function submitPromotionForm(
  currentState: unknown,
  formData: FormData
) {
  const code = formData.get("code") as string
  try {
    await applyPromotions([code])
  } catch (e: any) {
    return e.message
  }
}

// TODO: Pass a POJO instead of a form entity here
export async function setShippingAddress(formData: FormData) {
  try {
    if (!formData) {
      throw new Error("No form data found when setting addresses")
    }

    const cartId = await getCartId()
    const customer = await retrieveCustomer()

    if (!cartId) {
      throw new Error("No existing cart found when setting addresses")
    }

    const data = {
      shipping_address: {
        first_name: formData.get("shipping_address.first_name"),
        last_name: formData.get("shipping_address.last_name"),
        address_1: formData.get("shipping_address.address_1"),
        address_2: "",
        company: formData.get("shipping_address.company"),
        postal_code: formData.get("shipping_address.postal_code"),
        city: formData.get("shipping_address.city"),
        country_code: formData.get("shipping_address.country_code"),
        province: formData.get("shipping_address.province"),
        phone: formData.get("shipping_address.phone"),
      },
      // customer_id: customer?.id,
      email: customer?.email || formData.get("email"),
    } as any
    await updateCart(data)
  } catch (e: any) {
    throw new Error(e)
  }
}

export async function setBillingAddress(formData: FormData) {
  try {
    const cartId = getCartId()
    if (!cartId) {
      throw new Error("No existing cart found when setting billing address")
    }

    const data = {
      billing_address: {
        first_name: formData.get("billing_address.first_name"),
        last_name: formData.get("billing_address.last_name"),
        address_1: formData.get("billing_address.address_1"),
        address_2: "",
        company: formData.get("billing_address.company"),
        postal_code: formData.get("billing_address.postal_code"),
        city: formData.get("billing_address.city"),
        country_code: formData.get("billing_address.country_code"),
        province: formData.get("billing_address.province"),
        phone: formData.get("billing_address.phone"),
      },
    } as any

    await updateCart(data)
  } catch (e: any) {
    return e.message
  }
}

export async function setContactDetails(
  currentState: unknown,
  formData: FormData
) {
  try {
    const cartId = getCartId()
    if (!cartId) {
      throw new Error("No existing cart found when setting contact details")
    }
    const data = {
      email: formData.get("email") as string,
      metadata: {
        invoice_recipient: formData.get("invoice_recipient"),
        cost_center: formData.get("cost_center"),
        requisition_number: formData.get("requisition_number"),
        door_code: formData.get("door_code"),
        notes: formData.get("notes"),
      },
    }
    await updateCart(data)
  } catch (e: any) {
    return e.message
  }
}

export async function placeOrder(
  cartId?: string
): Promise<HttpTypes.StoreCompleteCartResponse> {
  const id = cartId || (await getCartId())

  if (!id) {
    throw new Error("No existing cart found when placing an order")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const cartsTag = await getCacheTag("carts")
  const ordersTag = await getCacheTag("orders")
  const approvalsTag = await getCacheTag("approvals")

  const response = await sdk.store.cart
    .complete(id, {}, headers)
    .catch(medusaError)

  if (response.type === "cart") {
    return response
  }

  track("order_completed", {
    order_id: response.order.id,
  })

  revalidateTag(cartsTag)
  revalidateTag(ordersTag)
  revalidateTag(approvalsTag)

  await removeCartId()

  redirect(
    `/${response.order.shipping_address?.country_code?.toLowerCase()}/order/confirmed/${
      response.order.id
    }`
  )
}

const BENEFIT_PAYMENT_PROVIDER_ID = "pp_system_default"

/*

Confirma el pedido desde el checkout de una sola página.

1. Si el carrito no tiene una sesión de pago "Cargo beneficio"
   (`pp_system_default`, sin pasarela), la crea. Se hace acá y no al entrar
   al checkout porque Medusa recrea la colección de pago cuando cambia el
   total del carrito.
2. Completa el carrito (`placeOrder`). Si todo sale bien, `placeOrder`
   redirige a /order/confirmed/:id (lanza NEXT_REDIRECT, que se propaga).
3. Si el backend rechaza el pedido (saldo de beneficio insuficiente, sin
   stock en el site, sin site elegido...) devuelve `{ error }` con el
   mensaje en español que arma el backend, para mostrarlo bajo el botón.

*/
export async function confirmOrder(): Promise<{ error: string } | void> {
  const cart = await retrieveCart()

  if (!cart) {
    return { error: "No encontramos tu carrito. Vuelve a la tienda e intenta de nuevo." }
  }

  try {
    const hasBenefitSession = cart.payment_collection?.payment_sessions?.some(
      (session) =>
        session.provider_id === BENEFIT_PAYMENT_PROVIDER_ID &&
        session.status === "pending"
    )

    if (!hasBenefitSession) {
      await initiatePaymentSession(cart, {
        provider_id: BENEFIT_PAYMENT_PROVIDER_ID,
      })
    }

    const response = await placeOrder(cart.id)

    if (response?.type === "cart") {
      return {
        error:
          response.error?.message ??
          "No se pudo confirmar el pedido. Intenta nuevamente.",
      }
    }
  } catch (error: any) {
    // redirect() de Next se implementa lanzando un error: hay que dejarlo pasar.
    if (typeof error?.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) {
      throw error
    }

    return {
      error: error?.message || "No se pudo confirmar el pedido. Intenta nuevamente.",
    }
  }
}

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId()
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  if (cartId) {
    await updateCart({ region_id: region.id })
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  const regionCacheTag = await getCacheTag("regions")
  revalidateTag(regionCacheTag)

  const productsCacheTag = await getCacheTag("products")
  revalidateTag(productsCacheTag)

  redirect(`/${countryCode}${currentPath}`)
}

export async function createCartApproval(cartId: string, createdBy: string) {
  const headers = {
    "Content-Type": "application/json",
    ...(await getAuthHeaders()),
  }

  const { approval } = await sdk.client
    .fetch<StoreApprovalResponse>(`/store/carts/${cartId}/approvals`, {
      method: "POST",
      headers,
      credentials: "include",
    })
    .catch((err) => {
      if (err.response?.json) {
        return err.response.json().then((body: any) => {
          throw new Error(body.message || err.message)
        })
      }
      throw err
    })

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  const approvalsCacheTag = await getCacheTag("approvals")
  revalidateTag(approvalsCacheTag)

  return approval
}
