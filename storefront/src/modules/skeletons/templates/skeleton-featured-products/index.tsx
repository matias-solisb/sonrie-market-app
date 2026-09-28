import repeat from "@/lib/util/repeat"
import { PRODUCT_RAIL_ITEM_CLASS } from "@/modules/home/components/featured-products/product-rail/item-class"
import SkeletonProductPreview from "@/modules/skeletons/components/skeleton-product-preview"

// Misma forma que `FeaturedProducts` (título + una fila del carrusel con el
// mismo ancho por item), para que no salte el layout cuando cargan los datos.
const SkeletonFeaturedProducts = () => {
  return (
    <div className="content-container pt-4 small:pt-6 pb-12 small:pb-16">
      <div className="mb-6 h-9 w-64 rounded-md bg-neutral-100" />

      <ul
        className="flex gap-4 overflow-hidden pb-2"
        data-testid="products-list-loader"
      >
        {repeat(6).map((index) => (
          <li key={index} className={PRODUCT_RAIL_ITEM_CLASS}>
            <SkeletonProductPreview />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SkeletonFeaturedProducts
