import { HttpTypes } from "@medusajs/types"
import ProductRail from "@/modules/home/components/featured-products/product-rail"

export default async function FeaturedProducts({
  collections,
  region,
  countryCode,
}: {
  collections: HttpTypes.StoreCollection[]
  region: HttpTypes.StoreRegion
  // countryCode se suma respecto del diseño original: lo necesita
  // ProductRail para poder mostrar el stepper de agregar-al-carrito en cada
  // ProductPreview (feature que no existía cuando se hizo este diseño).
  countryCode: string
}) {
  return collections.map((collection) => (
    <li key={collection.id}>
      <ProductRail
        collection={collection}
        region={region}
        countryCode={countryCode}
      />
    </li>
  ))
}
