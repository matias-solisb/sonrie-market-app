import { ShoppingBag } from "@medusajs/icons"
import Image from "next/image"
import { Suspense } from "react"

import { listCategories } from "@/lib/data/categories"
import { retrieveCustomer } from "@/lib/data/customer"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import AccountMenu from "@/modules/layout/components/account-menu"
import CartButton from "@/modules/layout/components/cart-button"
import CategoriesMenu from "@/modules/layout/components/categories-menu"
import MobileMenu from "@/modules/layout/components/mobile-menu"
import NotificationBell from "@/modules/layout/components/notification-bell"
import SearchBar from "@/modules/layout/components/search-bar"

const LOGO_URL =
  "https://s3.amazonaws.com/production-clients-images/sonrie.youorder.me/others/LOGO-Sonri%CC%81e-Market%20%28002%29.png"

// Brand red used on the categories sub-bar. Swap for the exact brand hex if
// this approximation doesn't match the design system.
const BRAND_RED = "#E01441"

// Se mantiene el nombre NavigationHeader (con export default y named export)
// porque dos archivos del B2B Starter que no se tocaron en este rediseño
// (app/[countryCode]/(main)/layout.tsx y modules/layout/templates/index.tsx)
// importan `{ NavigationHeader }` por nombre.
export async function NavigationHeader() {
  const [customer, categories] = await Promise.all([
    retrieveCustomer().catch(() => null),
    listCategories().catch(() => []),
  ])

  const topLevelCategories = (categories ?? []).filter(
    (category) => !category.parent_category
  )

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      <header className="relative border-b duration-200 bg-white border-ui-border-base">
        <nav className="content-container flex items-center justify-between w-full h-16 gap-x-6">
          <LocalizedClientLink
            href="/"
            className="flex items-center shrink-0"
            data-testid="nav-store-link"
          >
            <Image
              src={LOGO_URL}
              alt="Sonríe Market"
              width={180}
              height={48}
              className="h-10 w-auto"
              priority
            />
          </LocalizedClientLink>

          {customer && (
            <div className="hidden small:flex flex-1 max-w-xl">
              <SearchBar />
            </div>
          )}

          <div className="flex items-center gap-x-6 h-full">
            {customer ? (
              <>
                <AccountMenu customer={customer} />
                <NotificationBell />
              </>
            ) : (
              <LocalizedClientLink
                href="/account"
                className="txt-compact-small text-ui-fg-subtle hover:text-ui-fg-base"
                data-testid="nav-account-link"
              >
                Iniciar sesión
              </LocalizedClientLink>
            )}

            <Suspense
              fallback={
                <LocalizedClientLink
                  className="flex items-center gap-x-2 text-ui-fg-base hover:text-ui-fg-subtle"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  <ShoppingBag />
                  <span>$0</span>
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </nav>

        {customer && (
          <div className="content-container flex items-center gap-x-3 pb-3 small:hidden">
            <MobileMenu categories={topLevelCategories} />
            <SearchBar />
          </div>
        )}
      </header>

      {/* Franja roja de marca: mismo lugar que ocupa la barra de categorías
          de abajo (bloque siguiente), pero para visitantes sin sesión. Un
          bloque completo que aparece/desaparece, no un texto que se oculta. */}
      {!customer && (
        <div className="h-2 w-full" style={{ backgroundColor: BRAND_RED }} />
      )}

      {customer && topLevelCategories.length > 0 && (
        <div
          className="hidden small:block"
          style={{ backgroundColor: BRAND_RED }}
        >
          <div className="content-container flex items-center justify-between h-10 gap-x-6">
            <div className="flex items-center gap-x-6 shrink-0">
              <CategoriesMenu categories={topLevelCategories} />
              <LocalizedClientLink
                href="/products"
                className="flex items-center gap-x-2 txt-compact-small-plus font-semibold text-white hover:text-white/80"
                data-testid="nav-offers-link"
              >
                <span aria-hidden="true">%</span>
                Ofertas
              </LocalizedClientLink>
            </div>
            <ul
              className="hidden small:flex items-center gap-x-6 txt-compact-small text-white"
              data-testid="nav-categories"
            >
              {topLevelCategories.map((category) => (
                <li key={category.id}>
                  <LocalizedClientLink
                    href={`/categories/${category.handle}`}
                    className="font-semibold hover:text-white/80"
                  >
                    {category.name}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default NavigationHeader
