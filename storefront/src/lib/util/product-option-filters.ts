export const OPTION_VALUE_QUERY_KEY = "optionValueIds"
export const CATEGORY_QUERY_KEY = "category_id"

export type OptionValueIds = string[]
export type CategoryIds = string[]

export const parseOptionValueIds = (
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): OptionValueIds => {
  if (typeof (searchParams as URLSearchParams).getAll === "function") {
    const values = (searchParams as URLSearchParams).getAll(OPTION_VALUE_QUERY_KEY)
    return Array.from(new Set(values.filter(Boolean)))
  }

  const paramValue = (
    searchParams as Record<string, string | string[] | undefined>
  )[OPTION_VALUE_QUERY_KEY]

  if (Array.isArray(paramValue)) {
    return Array.from(new Set(paramValue.filter(Boolean)))
  }

  if (typeof paramValue === "string" && paramValue.length > 0) {
    return paramValue.split(",").filter(Boolean)
  }

  return []
}

export const parseCategoryIds = (
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): CategoryIds => {
  if (typeof (searchParams as URLSearchParams).getAll === "function") {
    const values = (searchParams as URLSearchParams).getAll(CATEGORY_QUERY_KEY)
    return Array.from(new Set(values.filter(Boolean)))
  }

  const paramValue = (
    searchParams as Record<string, string | string[] | undefined>
  )[CATEGORY_QUERY_KEY]

  if (Array.isArray(paramValue)) {
    return Array.from(new Set(paramValue.filter(Boolean)))
  }

  if (typeof paramValue === "string" && paramValue.length > 0) {
    return paramValue.split(",").filter(Boolean)
  }

  return []
}


// Filtros rápidos del catálogo (sidebar "Ofertas / Nuevos / Destacados").
// Cada uno es un booleano en la URL (?featured=true, ?new=true,
// ?promotions=true, combinables) que se traduce 1:1 al value de un
// product tag creado a mano en el Admin de Medusa (ver catalog-sidebar).
export const QUICK_FILTER_TAG_VALUES = ["featured", "new", "promotions"] as const

export type QuickFilterTagValue = (typeof QUICK_FILTER_TAG_VALUES)[number]

export const parseQuickFilterTagValues = (
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): QuickFilterTagValue[] => {
  const getValue = (key: string): string | undefined => {
    if (typeof (searchParams as URLSearchParams).get === "function") {
      return (searchParams as URLSearchParams).get(key) ?? undefined
    }

    const raw = (
      searchParams as Record<string, string | string[] | undefined>
    )[key]

    return Array.isArray(raw) ? raw[0] : raw
  }

  return QUICK_FILTER_TAG_VALUES.filter((tagValue) => getValue(tagValue) === "true")
}

// Metadata de UI de cada quick filter (id/label en español + su tagValue),
// compartida por catalog-sidebar (checkboxes) y selected-quick-filter-badges
// (badges "Ofertas ✕" bajo el conteo de resultados), para que ambos queden
// sincronizados con una sola fuente.
export type QuickFilter = {
  id: string
  label: string
  tagValue: QuickFilterTagValue
}

export const QUICK_FILTERS: QuickFilter[] = [
  { id: "ofertas", label: "Ofertas", tagValue: "promotions" },
  { id: "nuevos", label: "Nuevos", tagValue: "new" },
  { id: "destacados", label: "Destacados", tagValue: "featured" },
]
