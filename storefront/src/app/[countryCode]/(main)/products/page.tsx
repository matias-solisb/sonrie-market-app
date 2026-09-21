import { Metadata } from "next"

import {
  parseCategoryIds,
  parseOptionValueIds,
  parseQuickFilterTagValues,
} from "@/lib/util/product-option-filters"
import { SortOptions } from "@/modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@/modules/store/templates"

export const metadata: Metadata = {
  title: "Catálogo de productos",
  description: "Explora todo el catálogo de productos de Sonríe Market.",
}

type ProductsPageSearchParams = Record<string, string | string[] | undefined> & {
  sortBy?: SortOptions
  page?: string
  optionValueIds?: string | string[]
  category_id?: string | string[]
  q?: string
  // Filtros rápidos del sidebar — ver product-option-filters.ts
  featured?: string
  new?: string
  promotions?: string
}

type Params = {
  searchParams: Promise<ProductsPageSearchParams>
  params: Promise<{
    countryCode: string
  }>
}

export default async function ProductsPage(props: Params) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { sortBy, page, q } = searchParams
  const optionValueIds = parseOptionValueIds(searchParams)
  const categoryIds = parseCategoryIds(searchParams)
  const quickFilterTagValues = parseQuickFilterTagValues(searchParams)

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      optionValueIds={optionValueIds}
      categoryIds={categoryIds}
      quickFilterTagValues={quickFilterTagValues}
      q={q}
    />
  )
}
