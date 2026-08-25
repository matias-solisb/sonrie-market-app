"use client"

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Grid from "@/modules/common/icons/grid"
import { Fragment, useState } from "react"

const CategoriesMenu = ({
  categories,
}: {
  categories: HttpTypes.StoreProductCategory[]
}) => {
  const [open, setOpen] = useState(false)

  /*
  Submenu de categorías de productos, con opciones para ver cada categoría y un enlace para ver todos los productos.
  */
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Popover className="relative">
        <PopoverButton
          className="flex items-center gap-x-2 txt-compact-small-plus font-semibold text-white hover:text-white/80"
          data-testid="nav-categories-menu-button"
        >
          <Grid size={16} />
          Categorías de productos
        </PopoverButton>
        <Transition
          show={open}
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <PopoverPanel
            static
            className="absolute left-0 top-full z-50 mt-2 w-64 rounded-md border border-gray-200 bg-white text-ui-fg-base shadow-lg focus:outline-none"
            data-testid="nav-categories-panel"
          >
            <ul className="py-1">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  <LocalizedClientLink
                    href={`/categories/${category.handle}`}
                    className="block px-4 py-3 text-sm hover:bg-gray-50"
                  >
                    {category.name}
                  </LocalizedClientLink>
                </li>
              ))}
              <li>
                <LocalizedClientLink
                  href="/products"
                  className="block px-4 py-3 text-sm hover:bg-gray-50"
                >
                  Ver todos los productos
                </LocalizedClientLink>
              </li>
            </ul>
          </PopoverPanel>
        </Transition>
      </Popover>
    </div>
  )
}

export default CategoriesMenu
