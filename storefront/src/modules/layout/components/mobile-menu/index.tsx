"use client"

import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react"
import { BarsThree } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import { Fragment } from "react"

import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { SONRIE_LOGO_URL } from "@/lib/constants"

const MobileMenu = ({
  categories,
}: {
  categories: HttpTypes.StoreProductCategory[]
}) => {
  return (
    <Popover className="small:hidden">
      {({ open, close }) => (
        <>
          <PopoverButton
            className="flex items-center justify-center text-blue-900"
            aria-label="Abrir menú"
            data-testid="nav-mobile-menu-button"
          >
            <BarsThree />
          </PopoverButton>

          {open && (
            <div
              className="fixed inset-0 z-[60] bg-black/40"
              onClick={close}
              data-testid="mobile-menu-backdrop"
            />
          )}

          <Transition
            show={open}
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in duration-150"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <PopoverPanel
              static
              className="fixed inset-y-0 left-0 z-[61] flex w-4/5 max-w-xs flex-col overflow-y-auto bg-white shadow-xl"
              data-testid="mobile-menu-panel"
            >
              <div className="border-b border-ui-border-base p-4">
                <LocalizedClientLink
                  href="/"
                  className="flex items-center"
                  onClick={close}
                >
                  <Image
                    src={SONRIE_LOGO_URL}
                    alt="Sonríe Market"
                    width={140}
                    height={38}
                    className="h-9 w-auto"
                  />
                </LocalizedClientLink>
              </div>

              <LocalizedClientLink
                href="/products?promotions=true"
                className="flex items-center gap-x-3 border-b border-ui-border-base px-4 py-4 text-base font-semibold text-ui-fg-base"
                onClick={close}
                data-testid="mobile-menu-offers-link"
              >
                <span aria-hidden="true">%</span>
                Ofertas
              </LocalizedClientLink>

              {categories.length > 0 && (
                <>
                  <span className="px-4 pb-2 pt-4 text-sm text-ui-fg-subtle">
                    Categorías
                  </span>
                  <ul data-testid="mobile-menu-categories">
                    {categories.map((category) => (
                      <li
                        key={category.id}
                        className="border-b border-ui-border-base"
                      >
                        <LocalizedClientLink
                          href={`/products?category_id=${category.id}`}
                          className="block px-4 py-4 text-base font-semibold text-ui-fg-base"
                          onClick={close}
                        >
                          {category.name}
                        </LocalizedClientLink>
                      </li>
                    ))}
                    <li>
                      <LocalizedClientLink
                        href="/products"
                        className="block px-4 py-4 text-base font-semibold text-ui-fg-base"
                        onClick={close}
                      >
                        Ver todos los productos
                      </LocalizedClientLink>
                    </li>
                  </ul>
                </>
              )}
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  )
}

export default MobileMenu
