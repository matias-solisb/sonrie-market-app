"use client"

import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react"
import { ChevronDownMini, DocumentText, QueueList } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { signout } from "@/lib/data/customer"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import User from "@/modules/common/icons/user"
import UserCog from "@/modules/common/icons/user-cog"
import { useParams } from "next/navigation"
import { Fragment } from "react"

const AccountMenu = ({ customer }: { customer: HttpTypes.StoreCustomer }) => {
  const { countryCode } = useParams() as { countryCode: string }

  const displayName =
    customer.first_name?.toUpperCase() || customer.last_name?.toUpperCase()

  const fullName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()

  const handleLogout = async () => {
    await signout(countryCode, customer.id)
  }

  /*

  Submenu de cuenta de usuario, con opciones para ver el perfil, ver pedidos,
  ver documentos y cerrar sesión. Se utiliza el componente Menu de Headless UI
  para crear un menú desplegable accesible. El botón del menú muestra el
  icono de usuario y el nombre del cliente (si está disponible). La primera
  fila del panel es solo informativa (nombre y correo, sin link). Al hacer
  clic en "Cerrar sesión", se llama a la función handleLogout que realiza la
  acción de cierre de sesión.

  */
  return (
    <Menu as="div" className="relative flex items-center h-full">
      <MenuButton
        className="flex items-center gap-x-2 text-ui-fg-base hover:text-ui-fg-subtle txt-compact-small-plus"
        data-testid="nav-account-menu-button"
      >
        <User size={20} />
        <span className="hidden small:inline">{displayName}</span>
        <ChevronDownMini />
      </MenuButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <MenuItems
          anchor="bottom end"
          className="z-50 mt-2 w-64 rounded-md border border-ui-border-base bg-white shadow-lg focus:outline-none"
          data-testid="nav-account-menu"
        >
          <div
            className="border-b border-dashed border-gray-200 px-4 py-3"
            data-testid="nav-account-menu-header"
          >
            <p className="text-sm font-bold text-ui-fg-base">
              {fullName || displayName}
            </p>
            {customer.email && (
              <p className="text-sm">{customer.email}</p>
            )}
          </div>

          <div className="py-1">
            <MenuItem>
              {({ focus }) => (
                <LocalizedClientLink
                  href="/account/profile"
                  className={`flex items-center gap-x-3 border-b border-dashed border-gray-200 px-4 py-3 text-sm text-ui-fg-base ${
                    focus ? "bg-gray-50" : ""
                  }`}
                  data-testid="nav-account-menu-profile-link"
                >
                  <UserCog size={18} />
                  Perfil
                </LocalizedClientLink>
              )}
            </MenuItem>
            <MenuItem>
              {({ focus }) => (
                <LocalizedClientLink
                  href="/account/orders"
                  className={`flex items-center gap-x-3 border-b border-dashed border-gray-200 px-4 py-3 text-sm text-ui-fg-base ${
                    focus ? "bg-gray-50" : ""
                  }`}
                  data-testid="nav-account-menu-orders-link"
                >
                  <QueueList />
                  Pedidos
                </LocalizedClientLink>
              )}
            </MenuItem>
            <MenuItem>
              {({ focus }) => (
                <a
                  href="#"
                  className={`flex items-center gap-x-3 border-b border-dashed border-gray-200 px-4 py-3 text-sm text-ui-fg-base ${
                    focus ? "bg-gray-50" : ""
                  }`}
                  data-testid="nav-account-menu-documents-link"
                >
                  <DocumentText/>
                  Documentos
                </a>
              )}
            </MenuItem>
            <MenuItem>
              {({ focus }) => (
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`block w-full px-4 py-3 text-left text-sm font-semibold text-orange-600 ${
                    focus ? "bg-gray-50" : ""
                  }`}
                  data-testid="nav-account-menu-logout"
                >
                  Cerrar sesión
                </button>
              )}
            </MenuItem>
          </div>
        </MenuItems>
      </Transition>
    </Menu>
  )
}

export default AccountMenu
