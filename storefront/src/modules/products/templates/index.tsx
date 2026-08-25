import { Suspense } from "react"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import { retrieveCart } from "@/lib/data/cart"
import { getProductPrice } from "@/lib/util/get-product-price"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import AddToCartStepper from "@/modules/products/components/product-preview/add-to-cart-stepper"
import ProductOnboardingCta from "@/modules/products/components/product-onboarding-cta"
import RelatedProducts from "@/modules/products/components/related-products"
import Thumbnail from "@/modules/products/components/thumbnail"
import SkeletonRelatedProducts from "@/modules/skeletons/templates/skeleton-related-products"

// TODO: valor de demostración hasta que el multiplicador de mayoreo tenga un
// campo real en Medusa (misma idea que en paginated-products.tsx). Se
// deriva del id del producto solo para que no sea siempre el mismo número.
const DEMO_MULTIPLIERS = [10, 12, 15, 20, 6]

const getDemoMultiplier = (productId: string) => {
  const sum = productId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return DEMO_MULTIPLIERS[sum % DEMO_MULTIPLIERS.length]
}

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
}

const ProductTemplate = async ({
  product,
  region: _region,
  countryCode,
}: ProductTemplateProps) => {
  if (!product || !product.id) {
    return notFound()
  }

  // Categoría principal del producto — se usa para el breadcrumb
  // ("Catálogo > <categoría>") y para la etiqueta chica sobre el título.
  // El link de categoría reutiliza el filtro real que ya filtra /products
  // (?category_id=<id>), en vez de un ?category=<nombre> que no filtraría
  // nada ya que el catálogo matchea por id, no por nombre.
  const primaryCategory = product.categories?.[0]

  const { cheapestPrice } = getProductPrice({ product })

  // Igual que en las cards del catálogo: sin selector de variante en esta
  // vista simplificada, se agrega la primera variante del producto.
  const defaultVariant = product.variants?.[0]
  const defaultVariantId = defaultVariant?.id

  // La "marca" (ej. "Soprole") no es un campo propio del producto en
  // Medusa — se muestra la colección, siguiendo el mismo patrón que ya
  // usaba el starter original (modules/products/templates/product-info).
  const brand = product.collection?.title

  const cart = await retrieveCart()
  const cartItem = defaultVariantId
    ? cart?.items?.find((item) => item.variant_id === defaultVariantId)
    : undefined

  return (
    <>
      <div className="content-container py-6" data-testid="product-container">
        <div className="mb-6 flex items-center gap-x-2 text-base-regular">
          <LocalizedClientLink
            href="/products"
            className="font-semibold text-blue-900 hover:underline"
            data-testid="breadcrumb-catalog-link"
          >
            Catálogo
          </LocalizedClientLink>
          {primaryCategory && (
            <>
              <span className="text-ui-fg-muted">{">"}</span>
              <LocalizedClientLink
                href={`/products?category_id=${primaryCategory.id}`}
                className="font-semibold text-blue-900 hover:underline"
                data-testid="breadcrumb-category-link"
              >
                {primaryCategory.name}
              </LocalizedClientLink>
            </>
          )}
        </div>

        <ProductOnboardingCta />

        <div className="flex flex-col gap-y-8 small:flex-row small:items-start small:gap-x-12">
          {/* Solo la imagen principal — sin galería de miniaturas. Al no
              estar envuelta en ningún link, hacerle click no navega ni abre
              nada. */}
          <div className="w-full small:max-w-md">
            <Thumbnail
              thumbnail={product.thumbnail}
              images={product.images}
              size="square"
              multiplier={getDemoMultiplier(product.id)}
            />
          </div>

          <div className="flex w-full flex-col gap-y-4 small:min-h-[420px]">
            {primaryCategory && (
              <span className="lowercase text-base-regular text-ui-fg-subtle">
                {primaryCategory.name}
              </span>
            )}

            <h1
              className="text-2xl-semi text-ui-fg-base small:text-3xl-semi"
              data-testid="product-title"
            >
              {product.title}
            </h1>

            {brand && (
              <span className="text-base-regular text-ui-fg-subtle">
                {brand}
              </span>
            )}

            <div className="flex-1" />

            {cheapestPrice && (
              <div className="flex items-end justify-between gap-x-4">
                <span className="text-base-regular text-ui-fg-subtle">
                  Precio unitario: {cheapestPrice.calculated_price}
                </span>
                <span className="text-2xl-semi text-ui-fg-base">
                  {cheapestPrice.calculated_price}
                  <span className="text-base-regular text-ui-fg-subtle">
                    /Pack
                  </span>
                </span>
              </div>
            )}

            {defaultVariantId && (
              <div className="flex justify-end">
                <AddToCartStepper
                  variantId={defaultVariantId}
                  countryCode={countryCode}
                  initialQuantity={cartItem?.quantity ?? 0}
                  initialLineItemId={cartItem?.id}
                  className="w-56"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 max-w-2xl">
          <span className="inline-block border-b-2 border-blue-900 pb-2 text-base-semi text-ui-fg-base">
            Descripción
          </span>

          {product.description && (
            <p
              className="mt-6 whitespace-pre-line text-base-regular text-ui-fg-subtle"
              data-testid="product-description"
            >
              {product.description}
            </p>
          )}

          {defaultVariant?.sku && (
            <p className="mt-4 text-base-regular text-ui-fg-subtle">
              SKU: {defaultVariant.sku}
            </p>
          )}
        </div>
      </div>
      <div
        className="content-container my-4 small:my-4"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </>
  )
}

export default ProductTemplate
