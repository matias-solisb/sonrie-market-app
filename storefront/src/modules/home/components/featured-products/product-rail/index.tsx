import { listProducts } from "@/lib/data/products"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@/modules/common/components/ui"

import ProductPreview from "@/modules/products/components/product-preview"

export default async function ProductRail({
  collection,
  region,
  countryCode,
}: {
  collection: HttpTypes.StoreCollection
  region: HttpTypes.StoreRegion
  // Ver featured-products/index.tsx: se necesita para el stepper de
  // agregar-al-carrito de cada ProductPreview.
  countryCode: string
}) {
  // El diseño original llamaba a listProducts({ regionId: region.id, ... }),
  // pero la función real del B2B Starter no acepta un regionId directo:
  // resuelve la región internamente a partir de countryCode.
  // collection_id no está en el tipo StoreProductParams de esta versión de
  // @medusajs/types (mismo desfase de tipos que ya tolera
  // related-products/index.tsx sin tocar, del propio B2B Starter, con
  // collection_id/tag_id/is_giftcard), aunque la Store API sí lo soporta.
  const queryParams: Record<string, unknown> = {
    collection_id: collection.id,
    fields: "*variants.calculated_price",
  }

  const {
    response: { products: pricedProducts },
  } = await listProducts({
    countryCode,
    queryParams: queryParams as HttpTypes.FindParams &
      HttpTypes.StoreProductParams,
  })

  if (!pricedProducts) {
    return null
  }

  return (
    <div className="content-container pt-4 small:pt-6 pb-12 small:pb-24">
      <div className="flex justify-between mb-8">
        <Text className="!text-3xl">Productos destacados</Text>
      </div>
      <ul className="grid grid-cols-2 small:grid-cols-3 gap-x-6 gap-y-24 small:gap-y-36">
        {pricedProducts &&
          pricedProducts.map((product) => (
            <li key={product.id}>
              <ProductPreview
                product={product}
                region={region}
                countryCode={countryCode}
                isFeatured
              />
            </li>
          ))}
      </ul>
    </div>
  )
}
