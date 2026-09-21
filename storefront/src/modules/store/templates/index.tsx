import { Suspense } from "react"

import { listCategories } from "@/lib/data/categories"
import { OptionValueIds } from "@/lib/util/product-option-filters"
import SkeletonProductGrid from "@/modules/skeletons/templates/skeleton-product-grid"
import CatalogSidebar from "@/modules/store/components/catalog-sidebar"
import { SortOptions } from "@/modules/store/components/refinement-list/sort-products"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = async ({
  sortBy,
  page,
  countryCode,
  optionValueIds,
  categoryIds,
  q,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
  categoryIds?: string[]
  q?: string
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  const categories = await listCategories().catch(() => [])
  const topLevelCategories = (categories ?? []).filter(
    (category) => !category.parent_category
  )

  return (
    <div
      className="content-container flex flex-col gap-y-6 py-6 small:flex-row small:items-start small:gap-x-8"
      data-testid="category-container"
    >
      <CatalogSidebar
        categories={topLevelCategories}
        selectedCategoryIds={categoryIds ?? []}
      />
      <div className="w-full">
        <div className="mb-6 hidden small:block">
          <h1 className="text-2xl" data-testid="store-page-title">
            Catálogo de productos
          </h1>
        </div>
        <Suspense fallback={<SkeletonProductGrid />}>
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            countryCode={countryCode}
            optionValueIds={optionValueIds}
            categoryIds={categoryIds}
            categories={topLevelCategories}
            q={q}
          />
        </Suspense>
      </div>
    </div>
  )
}

export default StoreTemplate
