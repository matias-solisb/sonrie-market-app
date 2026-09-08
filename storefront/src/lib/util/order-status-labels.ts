import { HttpTypes } from "@medusajs/types"

/*

Diccionario de estados en español para "Mis pedidos". Medusa v2 expone dos
campos de estado independientes en la orden: `status` (ciclo de vida
comercial: pending/completed/canceled/...) y `fulfillment_status` (ciclo de
preparación/entrega: not_fulfilled/fulfilled/shipped/delivered/...). Para el
colaborador lo relevante es el estado de entrega, así que se prioriza
`fulfillment_status` y solo se cae a `status` para los casos que ese campo
no cubre (orden cancelada, o con acción pendiente).

*/

const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  not_fulfilled: "Pendiente de preparación",
  partially_fulfilled: "Preparación parcial",
  fulfilled: "Preparado",
  partially_shipped: "Despacho parcial",
  shipped: "Despachado",
  partially_delivered: "Entrega parcial",
  delivered: "Entregado",
  canceled: "Anulado",
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  completed: "Completado",
  draft: "Borrador",
  archived: "Archivado",
  canceled: "Anulado",
  requires_action: "Requiere acción",
}

export const getOrderStatusLabel = (
  order: Pick<HttpTypes.StoreOrder, "status" | "fulfillment_status">
): string => {
  if (order.status === "canceled") {
    return ORDER_STATUS_LABELS.canceled
  }

  if (order.status === "requires_action") {
    return ORDER_STATUS_LABELS.requires_action
  }

  if (order.fulfillment_status && FULFILLMENT_STATUS_LABELS[order.fulfillment_status]) {
    return FULFILLMENT_STATUS_LABELS[order.fulfillment_status]
  }

  return ORDER_STATUS_LABELS[order.status] ?? order.status
}
