"use server"

import { sdk } from "@/lib/config"
import { getAuthHeaders, getCacheOptions } from "@/lib/data/cookies"
import medusaError from "@/lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"

/*

Detalle de un pedido del colaborador.

`GET /store/orders/:id` de Medusa 2.21 NO devuelve `metadata` (no está entre
los campos permitidos del detalle, y `+metadata` se ignora sin error). La
fecha de retiro vive en `order.metadata.pickup_date` (pickup-scheduling), así
que la metadata se lee del listado (`GET /store/orders?id=…`, que sí la
incluye y ya viene filtrado por el colaborador logueado) y se agrega al
pedido.

*/
export const retrieveOrder = async (id: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("orders")),
  }

  const [order, metadata] = await Promise.all([
    sdk.client
      .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
        method: "GET",
        query: {
          fields:
            "*payment_collections.payments,*items,+items.metadata,*items.variant,*items.product",
        },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ order }) => order)
      .catch((err) => medusaError(err)),
    sdk.client
      .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
        method: "GET",
        query: { id, fields: "id,metadata", limit: 1 },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ orders }) => orders[0]?.metadata ?? null)
      // La metadata es un complemento: si falla, el pedido se muestra igual.
      .catch(() => null),
  ])

  return { ...order, metadata: order.metadata ?? metadata }
}

export const listOrders = async (
  limit: number = 10,
  offset: number = 0,
  filters?: Record<string, any>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("orders")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      method: "GET",
      query: {
        limit,
        offset,
        order: "-created_at",
        fields:
          "*items,+items.metadata,*items.variant,*items.product,*customer,*shipping_address,*fulfillments",
        ...filters,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ orders }) => orders)
    .catch((err) => medusaError(err))
}

// Igual que `listOrders`, pero además devuelve `count` — lo necesita la
// tabla de "Mis pedidos" (`OrdersTable`) para su paginación. Se deja como
// función aparte en vez de cambiar la forma del retorno de `listOrders`
// para no romper a sus otros llamadores (`account/@dashboard/page.tsx`,
// `employee-wrapper.tsx`), que ya esperan un arreglo plano.
export const listOrdersWithCount = async (
  limit: number = 10,
  offset: number = 0,
  filters?: Record<string, any>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("orders")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      method: "GET",
      query: {
        limit,
        offset,
        order: "-created_at",
        fields:
          "*items,+items.metadata,*items.variant,*items.product,*customer,*shipping_address,*fulfillments",
        ...filters,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ orders, count }) => ({ orders, count }))
    .catch((err) => medusaError(err))
}
