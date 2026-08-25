"use client"

import { XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import { CATEGORY_QUERY_KEY } from "@/lib/util/product-option-filters"

type SelectedCategoryBadgesProps = {
  categories: HttpTypes.StoreProductCategory[]
  selectedCategoryIds: string[]
}

// Un badge "Categoría: <nombre>" por cada categoría seleccionada en el
// sidebar/panel de filtros (ver catalog-sidebar), con una X para quitarla
// sin tener que volver a abrir el filtro. Reutiliza el mismo query param
// (category_id) que ya lee/escribe catalog-sidebar, así que ambos quedan
// sincronizados.
const SelectedCategoryBadges = ({
  categories,
  selectedCategoryIds,
}: SelectedCategoryBadgesProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const removeCategory = useCallback(
    (categoryId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const remaining = params
        .getAll(CATEGORY_QUERY_KEY)
        .filter((id) => id !== categoryId)

      params.delete(CATEGORY_QUERY_KEY)
      remaining.forEach((id) => params.append(CATEGORY_QUERY_KEY, id))
      params.delete("page")

      const queryString = params.toString()
      router.push(queryString ? `${pathname}?${queryString}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const selectedCategories = categories.filter((category) =>
    selectedCategoryIds.includes(category.id)
  )

  if (!selectedCategories.length) {
    return null
  }

  return (
    <div
      className="flex flex-wrap gap-x-2 gap-y-2"
      data-testid="selected-category-badges"
    >
      {selectedCategories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => removeCategory(category.id)}
          className="flex items-center gap-x-1.5 rounded-md bg-blue-900 px-3 py-1.5 text-small-regular text-white hover:bg-blue-800"
          data-testid={`selected-category-badge-${category.id}`}
        >
          Categoría: {category.name}
          <XMark />
        </button>
      ))}
    </div>
  )
}

export default SelectedCategoryBadges
