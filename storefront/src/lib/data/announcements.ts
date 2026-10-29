"use server"

import { sdk } from "@/lib/config"
import { getAuthHeaders } from "@/lib/data/cookies"
import { StoreAnnouncementsResponse } from "@/lib/util/announcement-place"

/*

Barra de anuncios sobre el header. A diferencia de los banners del home,
no se cachea: la respuesta depende de la sesión (sin sesión solo hay
anuncios si el admin habilitó el lugar "login") y de la hora (vigencia).
Es una query liviana.

Como la barra es decorativa, un error del backend no rompe la página:
se devuelve null y simplemente no se muestra.

*/
export const listAnnouncements =
  async (): Promise<StoreAnnouncementsResponse | null> => {
    try {
      return await sdk.client.fetch<StoreAnnouncementsResponse>(
        `/store/announcements`,
        {
          method: "GET",
          headers: { ...(await getAuthHeaders()) },
          cache: "no-store",
        }
      )
    } catch (error) {
      console.error("No se pudo cargar la barra de anuncios:", error)
      return null
    }
  }
