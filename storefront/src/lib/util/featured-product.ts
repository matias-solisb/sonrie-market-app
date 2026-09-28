import type { HttpTypes } from "@medusajs/types"

/*

Un producto es "destacado" si tiene el product tag con este value (creado
a mano en el Admin de Medusa). Lo usan:

- la sección "Productos destacados" de la home (filtra por este tag),
- el filtro rápido "Destacados" del catálogo (`?featured=true`),
- la etiqueta "Destacado" de la tarjeta de producto (`ProductPreview`).

Para que `isFeaturedProduct` funcione, la consulta de productos tiene que
pedir los tags (`fields: "...,+tags"`).

*/
export const FEATURED_TAG_VALUE = "featured" as const

export const isFeaturedProduct = (product: HttpTypes.StoreProduct) =>
  product.tags?.some((tag) => tag.value === FEATURED_TAG_VALUE) ?? false
