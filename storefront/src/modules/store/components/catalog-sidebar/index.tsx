"use client"

import * as Accordion from "@radix-ui/react-accordion"
import { ChevronDownMini } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import clsx from "clsx"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"

import {
  CATEGORY_QUERY_KEY,
  QUICK_FILTERS,
  QuickFilterTagValue,
} from "@/lib/util/product-option-filters"

// `variant`:
//  - "card"  → sidebar fijo de escritorio (con su propia caja con borde),
//              oculto en mobile.
//  - "panel" → mismo contenido, sin la caja con borde, para usarse dentro
//              del panel de filtros de mobile (ver mobile-filters).
const CatalogSidebar = ({
  categories,
  selectedCategoryIds,
  variant = "card",
}: {
  categories: HttpTypes.StoreProductCategory[]
  selectedCategoryIds: string[]
  variant?: "card" | "panel"
}) => {
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(true)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const toggleQuickFilter = useCallback(
    (tagValue: QuickFilterTagValue) => {
      const params = new URLSearchParams(searchParams.toString())
      const isChecked = params.get(tagValue) === "true"

      if (isChecked) {
        params.delete(tagValue)
      } else {
        params.set(tagValue, "true")
      }

      params.delete("page")

      const queryString = params.toString()
      router.push(queryString ? `${pathname}?${queryString}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const toggleCategory = useCallback(
    (categoryId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const current = params.getAll(CATEGORY_QUERY_KEY)
      const isSelected = current.includes(categoryId)
      const next = isSelected
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]

      params.delete(CATEGORY_QUERY_KEY)
      next.forEach((id) => params.append(CATEGORY_QUERY_KEY, id))
      params.delete("page")

      const queryString = params.toString()
      router.push(queryString ? `${pathname}?${queryString}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const content = (
    <>
      <div className="flex flex-col gap-y-3">
        <div className="mb-6 hidden small:block">
          <h1 className="text-2xl-semi" data-testid="store-page-title">
            Filtros
        </h1>
        </div>
        {QUICK_FILTERS.map((filter) => (
          <label
            key={filter.id}
            className="flex items-center gap-x-3 text-base-regular text-ui-fg-base cursor-pointer"
          >
            <input
              type="checkbox"
              checked={searchParams.get(filter.tagValue) === "true"}
              onChange={() => toggleQuickFilter(filter.tagValue)}
              className="h-4 w-4 rounded border-ui-border-base text-ui-fg-interactive focus:ring-0"
              data-testid={`catalog-filter-${filter.id}`}
            />
            {filter.label}
          </label>
        ))}
      </div>

      {categories.length > 0 && (
        <Accordion.Root
          type="single"
          collapsible
          value={isCategoriesOpen ? "categorias" : ""}
          onValueChange={(value) =>
            setIsCategoriesOpen(value === "categorias")
          }
        >
          <Accordion.Item value="categorias">
            <Accordion.Header>
              <Accordion.Trigger
                className="flex w-full items-center justify-between text-base-semi text-ui-fg-base"
                data-testid="catalog-categories-trigger"
              >
                Categorías
                <span
                  className={clsx(
                    "text-ui-fg-muted transition-transform duration-150",
                    { "rotate-180": isCategoriesOpen }
                  )}
                >
                  <ChevronDownMini />
                </span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="flex flex-col gap-y-3 pt-4">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-x-3 text-base-regular text-ui-fg-subtle cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                    className="h-4 w-4 rounded border-ui-border-base text-ui-fg-interactive focus:ring-0"
                    data-testid={`catalog-filter-category-${category.id}`}
                  />
                  {category.name}
                </label>
              ))}
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )}
    </>
  )

  if (variant === "panel") {
    return (
      <div className="flex flex-col gap-y-6" data-testid="catalog-sidebar-panel">
        {content}
      </div>
    )
  }

  return (
    <aside
      className="hidden w-full shrink-0 small:block small:w-64"
      data-testid="catalog-sidebar"
    >
      <div className="flex flex-col gap-y-6 rounded-md border border-ui-border-base p-5 shadow-sm">
        {content}
      </div>
    </aside>
  )
}

export default CatalogSidebar
