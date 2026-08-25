import { Text } from "@/modules/common/components/ui"
import { getProductPrice } from "@/lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"
import AddToCartStepper from "./add-to-cart-stepper"

export default async function ProductPreview({
  product,
  isFeatured,
  destacado,
  multiplier,
  region: _region,
  countryCode,
  cartQuantity,
  cartLineItemId,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  destacado?: boolean
  multiplier?: number
  region: HttpTypes.StoreRegion
  countryCode?: string
  cartQuantity?: number
  cartLineItemId?: string
}) {
  const { cheapestPrice } = getProductPrice({
    product,
  })

  // Quick-add usa la variante por defecto del producto (la primera). Para
  // productos con varias variantes esto es una simplificación: no hay
  // selector de variante en la card, igual que en el diseño de referencia.
  const defaultVariantId = product.variants?.[0]?.id

  return (
    <div data-testid="product-wrapper">
      <LocalizedClientLink
        href={`/products/${product.handle}`}
        className="group block"
      >
        <Thumbnail
          thumbnail={product.thumbnail}
          images={product.images}
          size="full"
          isFeatured={isFeatured}
          destacado={destacado}
          multiplier={multiplier}
        />
        <div className="flex txt-compact-medium mt-4 justify-between">
          <Text className="text-ui-fg-subtle" data-testid="product-title">
            {product.title}
          </Text>
          <div className="flex items-center gap-x-2">
            {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
          </div>
        </div>
      </LocalizedClientLink>

      {countryCode && defaultVariantId && (
        <div className="mt-3">
          <AddToCartStepper
            variantId={defaultVariantId}
            countryCode={countryCode}
            initialQuantity={cartQuantity ?? 0}
            initialLineItemId={cartLineItemId}
          />
        </div>
      )}
    </div>
  )
}
