"use server"

import { sdk } from "@/lib/config"

export type StoreStockLocationAddress = {
  address_1: string | null
  address_2?: string | null
  city: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
}

export type StoreStockLocation = {
  id: string
  name: string
  address: StoreStockLocationAddress | null
}

// Sites de retiro (Stock Locations) para el selector de "Seleccione las
// opciones de entrega" en el carrito. Igual que listBanners: es data
// pública sin relación con la sesión, así que se revalida por tiempo (no
// por tag) y, si el backend no responde, preferimos devolver [] (el
// selector queda deshabilitado) a romper la página del carrito completa.
export const listStockLocations = async (): Promise<StoreStockLocation[]> => {
  try {
    const { stock_locations } = await sdk.client.fetch<{
      stock_locations: StoreStockLocation[]
    }>(`/store/stock-locations`, {
      method: "GET",
      next: { revalidate: 60 },
      cache: "force-cache",
    })
    return stock_locations
  } catch (error) {
    console.error("No se pudieron cargar los sites de retiro:", error)
    return []
  }
}
