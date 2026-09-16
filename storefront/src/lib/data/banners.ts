"use server"

import { sdk } from "@/lib/config"

export type StoreBanner = {
  id: string
  image_url: string
  orden: number
}

// Carrusel del home: antes era un array hardcodeado en el componente
// Hero, ahora sale del módulo `banners` vía Store API. Revalidación por
// tiempo (no por tag) porque es contenido público sin relación con el
// carrito/cliente de la sesión — un cambio de marketing en el panel de
// Admin tarda como máximo ~60s en reflejarse acá, sin necesitar un
// redeploy del storefront.
//
// A diferencia de otros fetchers de este archivo, acá no se propaga el
// error con medusaError: el carrusel es decorativo, así que si el
// backend no responde preferimos que el home se vea sin banners a que
// se caiga la página completa por esto.
export const listBanners = async (): Promise<StoreBanner[]> => {
  try {
    const { banners } = await sdk.client.fetch<{ banners: StoreBanner[] }>(
      `/store/banners`,
      {
        method: "GET",
        next: { revalidate: 60 },
        cache: "force-cache",
      }
    )
    return banners
  } catch (error) {
    console.error("No se pudieron cargar los banners del home:", error)
    return []
  }
}
