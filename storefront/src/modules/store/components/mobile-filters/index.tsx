"use client"

import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react"
import { Funnel, XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Fragment } from "react"

import CatalogSidebar from "@/modules/store/components/catalog-sidebar"

const MobileFilters = ({
  categories,
  selectedCategoryIds,
}: {
  categories: HttpTypes.StoreProductCategory[]
  selectedCategoryIds: string[]
}) => {
  return (
    <Popover className="small:hidden">
      {({ open, close }) => (
        <>
          <PopoverButton
            className="flex items-center gap-x-2 rounded-md border border-blue-900 px-4 py-2 text-base-regular font-medium text-blue-900"
            data-testid="mobile-filters-button"
          >
            <Funnel />
            Filtros
          </PopoverButton>

          <Transition
            show={open}
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <PopoverPanel
              static
              className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-white p-5"
              data-testid="mobile-filters-panel"
            >
              <div className="mb-4 flex items-center gap-x-3 border-b border-ui-border-base pb-4">
                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar filtros"
                  data-testid="mobile-filters-close"
                >
                  <XMark />
                </button>
                <span className="text-large-semi text-ui-fg-base">Filtros</span>
              </div>
              <CatalogSidebar
                variant="panel"
                categories={categories}
                selectedCategoryIds={selectedCategoryIds}
              />
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  )
}

export default MobileFilters
