import { HttpTypes } from "@medusajs/types"
import { formatPickupDate, isPickupDate } from "@/lib/util/pickup-date"

/*

Estado del retiro de un pedido, como lo ve el colaborador en "Mis pedidos".

Se calcula con datos que la orden ya trae, sin endpoint nuevo:
- `status` = canceled                      → Anulado
- todos los cumplimientos con delivered_at → Entregado (el operador lo
  marcó en "Retiros del día" del Admin)
- `metadata.pickup_date` vs. hoy en Chile  → Retira hoy / No retirado /
                                              Agendado

Mismas palabras que el Admin (backend/src/admin/lib/estado-retiro.tsx):
si cambias una acá, cámbiala allá.

F1 — "Listo para retiro": un cumplimiento creado y no entregado será
"preparado". Agregar ese caso cuando exista el paso en el Admin.

*/

export type PickupStatus =
  | "agendado"
  | "retira_hoy"
  | "no_retirado"
  | "retirado"
  | "anulado"

export const PICKUP_STATUS_LABELS: Record<PickupStatus, string> = {
  agendado: "Agendado",
  retira_hoy: "Retira hoy",
  no_retirado: "No retirado",
  retirado: "Entregado",
  anulado: "Anulado",
}

/** Fecha de hoy en Chile ("YYYY-MM-DD"), sin depender de la zona del servidor. */
export const todayInChile = (now: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value

  return `${get("year")}-${get("month")}-${get("day")}`
}

type OrderLike = Pick<HttpTypes.StoreOrder, "status" | "metadata"> & {
  fulfillments?: { delivered_at?: string | Date | null; canceled_at?: string | Date | null }[] | null
}

/** Fecha en que se entregó (la última entrega), o null si no se ha entregado completo. */
export const deliveredAt = (order: OrderLike): string | null => {
  const activos = (order.fulfillments ?? []).filter((f) => f && !f.canceled_at)

  if (!activos.length || activos.some((f) => !f.delivered_at)) {
    return null
  }

  const fechas = activos
    .map((f) => new Date(f.delivered_at as string).toISOString())
    .sort()

  return fechas[fechas.length - 1]
}

/** null si el pedido no tiene fecha de retiro (no pasó por la agenda). */
export const getPickupStatus = (
  order: OrderLike,
  today: string = todayInChile()
): PickupStatus | null => {
  if (order.status === "canceled") return "anulado"
  if (deliveredAt(order)) return "retirado"

  const fecha = order.metadata?.pickup_date
  if (!isPickupDate(fecha)) return null

  if (fecha === today) return "retira_hoy"
  return fecha < today ? "no_retirado" : "agendado"
}

/** Instante → "8 de octubre" (hora de Chile). */
const formatDeliveredDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    timeZone: "America/Santiago",
  })

/** Frase para el detalle del pedido. */
export const getPickupSentence = (
  order: OrderLike,
  today: string = todayInChile()
): string | null => {
  const status = getPickupStatus(order, today)
  const fecha = order.metadata?.pickup_date as string

  switch (status) {
    case "anulado":
      return "Pedido anulado."
    case "retirado": {
      const at = deliveredAt(order)
      return at ? `Entregado el ${formatDeliveredDate(at)}.` : "Entregado."
    }
    case "retira_hoy":
      return "Tu pedido se retira hoy en la sala de venta."
    case "no_retirado":
      return `No retiraste tu pedido el ${formatPickupDate(fecha)}. Acércate a la sala de venta.`
    case "agendado":
      return `Retira el ${formatPickupDate(fecha)}.`
    default:
      return null
  }
}
