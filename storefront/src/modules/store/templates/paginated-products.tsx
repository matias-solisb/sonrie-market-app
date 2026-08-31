import { retrieveCart } from "@/lib/data/cart"
import { listProductsWithSort } from "@/lib/data/products"
import { getRegion } from "@/lib/data/regions"
import { OptionValueIds } from "@/lib/util/product-option-filters"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@/modules/products/components/product-preview"
import { Pagination } from "@/modules/store/components/pagination"
import MobileFilters from "@/modules/store/components/mobile-filters"
import SelectedCategoryBadges from "@/modules/store/components/selected-category-badges"
import { SortOptions } from "@/modules/store/components/refinement-list/sort-products"
import EmptyProductsState from "@/modules/store/components/empty-products-state"

const PRODUCT_LIMIT = 12

// TODO: valores de demostración hasta que "destacado" y el multiplicador de
// mayoreo tengan un campo real en Medusa (colección, tag o metadata — ver
// nota en catalog-sidebar). Por ahora solo son visuales.
const DEMO_MULTIPLIERS = [10, 12, 15, 20]

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  order?: string
  q?: string
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
  q?: string
  // Categorías para el botón "Filtros" que se muestra solo en mobile (ver
  // mobile-filters) y para los badges de categoría seleccionada — en
  // desktop el filtro de categorías vive en el sidebar fijo
  // (catalog-sidebar), que se arma en store/templates/index.tsx.
  categories?: HttpTypes.StoreProductCategory[]
}) {
  const queryParams: PaginatedProductsParams = {
    limit: 12,
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
                    destacado={index % 3 === 0}
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
