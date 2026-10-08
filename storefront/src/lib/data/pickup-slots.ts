"use server"

import { sdk } from "@/lib/config"
import { getAuthHeaders } from "./cookies"

export type PickupSlot = {
  /** "YYYY-MM-DD" */
  fecha: string
  disponible: boolean
  /** Cupos libres en este momento (0 si está cerrado o lleno). */
  cupos: number
  /** Por qué está cerrado (feriado, inventario…), si se indicó. */
  motivo: string | null
}

export type PickupSlots = {
  stock_location_id: string
  desde: string | null
  hasta: string | null
  fechas: PickupSlot[]
}

/*

Fechas de retiro del site (GET /store/pickup-slots), para el selector del
checkout. Sin caché: los cupos cambian con cada compra. Es una foto; el
cupo se toma recién al confirmar el pedido.

Si el backend no responde devuelve null (el selector muestra un aviso) en
vez de romper el checkout completo.

*/
export const listPickupSlots = async (
  stockLocationId: string
): Promise<PickupSlots | null> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<PickupSlots>(`/store/pickup-slots`, {
      method: "GET",
      query: { stock_location_id: stockLocationId },
      headers,
      cache: "no-store",
    })
    .catch((error) => {
      console.error("No se pudieron cargar las fechas de retiro:", error)
      return null
    })
}
