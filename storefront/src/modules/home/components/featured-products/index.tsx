import { listProducts } from "@/lib/data/products"
import { listProductTagsByValue } from "@/lib/data/product-tags"
import { FEATURED_TAG_VALUE } from "@/lib/util/featured-product"
import { Text } from "@/modules/common/components/ui"
import ProductRail from "@/modules/home/components/featured-products/product-rail"
import { PRODUCT_RAIL_ITEM_CLASS } from "@/modules/home/components/featured-products/product-rail/item-class"
import ProductPreview from "@/modules/products/components/product-preview"
import { HttpTypes } from "@medusajs/types"

// Máximo de productos en el carrusel de la home. Para ver todos está el
// catálogo filtrado (link "Ver todos").
const FEATURED_LIMIT = 20

/*
Sección "Productos destacados" de la home: SOLO los productos con el tag
`featured`, en un carrusel horizontal (`ProductRail`).

Si no existe el tag o ningún producto lo tiene, la sección no se muestra.
*/
export default async function FeaturedProducts({
  region,
  countryCode,
}: {
  region: HttpTypes.StoreRegion
  // Lo necesita ProductPreview para el stepper de agregar-al-carrito.
  countryCode: string
}) {
  const featuredTags = await listProductTagsByValue([FEATURED_TAG_VALUE])

  if (!featuredTags.length) {
    return null
  }

  // `tag_id` no está en el tipo StoreProductParams de esta versión de
  // @medusajs/types, aunque la Store API sí lo soporta (mismo caso que en
  // store/templates/paginated-products.tsx).
  const queryParams: Record<string, unknown> = {
    tag_id: featuredTags.map((tag) => tag.id),
    limit: FEATURED_LIMIT,
    // `+tags` para que ProductPreview muestre la etiqueta "Destacado".
    fields: "*variants.calculated_price,+tags",
  }

  const {
    response: { products },
  } = await listProducts({
    countryCode,
    queryParams: queryParams as HttpTypes.FindParams &
      HttpTypes.StoreProductParams,
  })

  if (!products.length) {
    return null
  }

  return (
    <section
      className="content-container pt-4 small:pt-6 pb-12 small:pb-16"
      data-testid="featured-products"
    >
      <div className="mb-6 flex items-end justify-between">
        <Text className="!text-3xl">Productos destacados</Text>
      </div>

      <ProductRail label="Productos destacados">
        {products.map((product) => (
          <li key={product.id} className={PRODUCT_RAIL_ITEM_CLASS}>
            <ProductPreview
              product={product}
              region={region}
              countryCode={countryCode}
              isFeatured
            />
          </li>
        ))}
      </ProductRail>
    </section>
  )
}
