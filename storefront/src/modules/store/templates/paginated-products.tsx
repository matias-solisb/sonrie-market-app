import { retrieveCart } from "@/lib/data/cart"
import { listProductsWithSort } from "@/lib/data/products"
import { listProductTagsByValue } from "@/lib/data/product-tags"
import { getRegion } from "@/lib/data/regions"
import {
  OptionValueIds,
  QuickFilterTagValue,
} from "@/lib/util/product-option-filters"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@/modules/products/components/product-preview"
import { Pagination } from "@/modules/store/components/pagination"
import MobileFilters from "@/modules/store/components/mobile-filters"
import SelectedCategoryBadges from "@/modules/store/components/selected-category-badges"
import SelectedQuickFilterBadges from "@/modules/store/components/selected-quick-filter-badges"
import { SortOptions } from "@/modules/store/components/refinement-list/sort-products"
import EmptyProductsState from "@/modules/store/components/empty-products-state"

const PRODUCT_LIMIT = 12

// TODO: el multiplicador de mayoreo sigue siendo un valor de demostración —
// "destacado" ya no lo es, ver más abajo (p.tags), se resolvió con el
// product tag "featured" creado en el Admin.
const DEMO_MULTIPLIERS = [10, 12, 15, 20]

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  tag_id?: string[]
  id?: string[]
  order?: string
  q?: string
  fields?: string
}

export default async function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  categoryId,
  categoryIds,
  productsIds,
  countryCode,
  optionValueIds,
  quickFilterTagValues,
  categories,
  q,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryId?: string
  categoryIds?: string[]
  productsIds?: string[]
  countryCode: string
  optionValueIds?: OptionValueIds
  // Filtros rápidos "Ofertas/Nuevos/Destacados" del sidebar (ver
  // catalog-sidebar): cada uno es el value de un product tag creado a
  // mano en el Admin. Varios seleccionados a la vez es un OR (Medusa
  // trae productos que tengan CUALQUIERA de los tag_id dados), igual que
  // ya pasa con categoryIds.
  quickFilterTagValues?: QuickFilterTagValue[]
  q?: string
  // Categorías para el botón "Filtros" que se muestra solo en mobile (ver
  // mobile-filters) y para los badges de categoría seleccionada — en
  // desktop el filtro de categorías vive en el sidebar fijo
  // (catalog-sidebar), que se arma en store/templates/index.tsx.
  categories?: HttpTypes.StoreProductCategory[]
}) {
  const queryParams: PaginatedProductsParams = {
    limit: 12,
    // +tags suma la relación de product tags al fetch por defecto
    // (*variants.calculated_price, ver listProducts) — se necesita para
    // saber, por producto, si trae el tag "featured" y así pintar el
    // ribbon "Destacado" de la card (ver p.tags más abajo).
    fields: "*variants.calculated_price,+tags",
  }

  if (collectionId) {
    queryParams["collection_id"] = [collectionId]
  }

  if (categoryId) {
    queryParams["category_id"] = [categoryId]
  }

  // categoryIds (checkboxes del sidebar de /products) tiene prioridad sobre
  // el categoryId singular (usado por la página de una categoría puntual).
  if (categoryIds?.length) {
    queryParams["category_id"] = categoryIds
  }

  if (productsIds) {
    queryParams["id"] = productsIds
  }

  if (quickFilterTagValues?.length) {
    const matchingTags = await listProductTagsByValue(quickFilterTagValues)

    // Si algún value todavía no tiene tag creado en el Admin, simplemente
    // no aporta ids — no rompe el resto de los filtros seleccionados.
    if (matchingTags.length) {
      queryParams["tag_id"] = matchingTags.map((tag) => tag.id)
    }
  }

  if (sortBy === "created_at") {
    queryParams["order"] = "created_at"
  }

  if (q) {
    queryParams["q"] = q
  }

  const [region, cart] = await Promise.all([
    getRegion(countryCode),
    retrieveCart(),
  ])

  if (!region) {
    return null
  }

  const {
    response: { products, count },
  } = await listProductsWithSort({
    page,
    queryParams,
    sortBy,
    countryCode,
    optionValueIds,
  })

  // Mapa variant_id -> line item del carrito actual, para que cada card
  // pueda mostrar el stepper de cantidad ya posicionado si el producto (su
  // variante por defecto) ya está en el carrito.
  const cartItemByVariantId = new Map<string, HttpTypes.StoreCartLineItem>(
    (cart?.items ?? [])
      .filter((item): item is HttpTypes.StoreCartLineItem & { variant_id: string } =>
        !!item.variant_id
      )
      .map((item) => [item.variant_id, item])
  )

  const totalPages = Math.ceil(count / PRODUCT_LIMIT)

  return (
    <>
      <div className="mb-4 flex flex-col gap-y-3">
        <div className="flex items-center justify-between gap-x-4">
          <div className="small:hidden">
            <MobileFilters
              categories={categories ?? []}
              selectedCategoryIds={categoryIds ?? []}
            />
          </div>
          <p
            className="ml-auto text-base-regular text-ui-fg-subtle small:ml-0"
            data-testid="products-count"
          >
            {count} producto{count === 1 ? "" : "s"} encontrado
            {count === 1 ? "" : "s"}
          </p>
        </div>

        <SelectedCategoryBadges
          categories={categories ?? []}
          selectedCategoryIds={categoryIds ?? []}
        />
        <SelectedQuickFilterBadges
          selectedQuickFilterTagValues={quickFilterTagValues ?? []}
        />
      </div>

      {count === 0 ? (
        <EmptyProductsState />
      ) : (
        <>
          {totalPages > 1 && (
            <div className="small:hidden">
              <Pagination
                data-testid="product-pagination-mobile"
                page={page}
                totalPages={totalPages}
                className="mt-0 mb-6"
              />
            </div>
          )}

          <ul
            className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8"
            data-testid="products-list"
          >
            {products.map((p, index) => {
              const defaultVariantId = p.variants?.[0]?.id
              const cartItem = defaultVariantId
                ? cartItemByVariantId.get(defaultVariantId)
                : undefined

              return (
                <li key={p.id}>
                  <ProductPreview
                    product={p}
                    region={region}
                    countryCode={countryCode}
                    destacado={
                      p.tags?.some((tag) => tag.value === "featured") ?? false
                    }
                    multiplier={DEMO_MULTIPLIERS[index % DEMO_MULTIPLIERS.length]}
                    cartQuantity={cartItem?.quantity}
                    cartLineItemId={cartItem?.id}
                  />
                </li>
              )
            })}
          </ul>
          {totalPages > 1 && (
            <div className="hidden small:block">
              <Pagination
                data-testid="product-pagination"
                page={page}
                totalPages={totalPages}
              />
            </div>
          )}
        </>
      )}
    </>
  )
}
