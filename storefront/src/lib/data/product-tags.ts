"use server"

import { sdk } from "@/lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

// El JS SDK de esta versión no expone un helper tipado para
// /store/product-tags (sí existe como ruta nativa del core de Medusa v2),
// así que se llama directo con sdk.client.fetch, igual que collections.ts.
export const listProductTagsByValue = async (
  values: string[]
): Promise<HttpTypes.StoreProductTag[]> => {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)))

  if (!uniqueValues.length) {
    return []
  }

  const next = {
    ...(await getCacheOptions("product-tags")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreProductTagListResponse>("/store/product-tags", {
      query: { value: uniqueValues, limit: uniqueValues.length },
      next,
      cache: "force-cache",
    })
    .then(({ product_tags }) => product_tags)
}
