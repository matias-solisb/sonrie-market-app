"use client"

import { XMark } from "@medusajs/icons"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import {
  QUICK_FILTERS,
  QuickFilterTagValue,
} from "@/lib/util/product-option-filters"

type SelectedQuickFilterBadgesProps = {
  selectedQuickFilterTagValues: QuickFilterTagValue[]
}

// Un badge "<Ofertas/Nuevos/Destacados> ✕" por cada quick filter marcado en
// el sidebar/panel de filtros (ver catalog-sidebar), con una X para
// quitarlo sin volver a abrir el filtro. Reutiliza el mismo query param
// booleano (?featured=true, etc.) que ya lee/escribe catalog-sidebar, así
// que ambos quedan sincronizados. Hermano de selected-category-badges.
const SelectedQuickFilterBadges = ({
  selectedQuickFilterTagValues,
}: SelectedQuickFilterBadgesProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const removeQuickFilter = useCallback(
    (tagValue: QuickFilterTagValue) => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete(tagValue)
      params.delete("page")

      const queryString = params.toString()
      router.push(queryString ? `${pathname}?${queryString}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const selectedFilters = QUICK_FILTERS.filter((filter) =>
    selectedQuickFilterTagValues.includes(filter.tagValue)
  )

  if (!selectedFilters.length) {
    return null
  }

  return (
    <div
      className="flex flex-wrap gap-x-2 gap-y-2"
      data-testid="selected-quick-filter-badges"
    >
      {selectedFilters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => removeQuickFilter(filter.tagValue)}
          className="flex items-center gap-x-1.5 rounded-md bg-blue-900 px-3 py-1.5 text-small-regular text-white hover:bg-blue-800"
          data-testid={`selected-quick-filter-badge-${filter.id}`}
        >
          {filter.label}
          <XMark />
        </button>
      ))}
    </div>
  )
}

export default SelectedQuickFilterBadges
