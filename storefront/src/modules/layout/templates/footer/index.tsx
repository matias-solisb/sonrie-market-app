import { ChevronDown } from "@medusajs/icons"
import Image from "next/image"

import { retrieveCustomer } from "@/lib/data/customer"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import ShippingConditionsModal from "@/modules/layout/components/shipping-conditions-modal"
import { SONRIE_LOGO_URL } from "@/lib/constants"

type FooterLink = {
  label: string
  href: string
}

type FooterColumn = {
  title: string
  links: FooterLink[]
}

// TODO: several of these links don't have a real page yet (Pagos, Nuevos
// Productos, Destacados, Productos Recomendados, Contacto, Preguntas
// Frecuentes, Terminos y Condiciones). They point to "#" as a placeholder
// until those routes exist — swap in the real href once they're built.
// "Condiciones de Despacho" es la excepción: en vez de un href abre un
// modal (ver ShippingConditionsModal / FooterLinkItem más abajo), como en
// el sitio legacy.
const ACCOUNT_COLUMN: FooterColumn = {
  title: "Cuenta",
  links: [
    { label: "Mis Datos", href: "/account/profile" },
    { label: "Carrito de Compra", href: "/cart" },
    { label: "Mis pedidos", href: "/account/orders" },
  ],
}

// "Enlaces útiles" cambia de contenido según haya sesión o no (ver
// capturas de referencia "Sin login" / "Con login" del sitio legacy):
// - Con login aparece "Pagos" primero, y desaparece "Productos
//   Recomendados".
// - Sin login aparece "Productos Recomendados" al final, y no hay
//   "Pagos" (no hay nada que pagar sin cuenta).
// El resto de la columna (Ofertas, Nuevos Productos, Destacados) es
// igual en ambos casos.
const buildUsefulLinksColumn = (isLoggedIn: boolean): FooterColumn => ({
  title: "Enlaces útiles",
  links: [
    /* ...(isLoggedIn ? [{ label: "Pagos", href: "#" }] : []), */
    { label: "Ofertas", href: "/products?promotions=true" },
    { label: "Nuevos Productos", href: "/products?new=true" },
    { label: "Destacados", href: "/products?featured=true" },
    ...(!isLoggedIn ? [{ label: "Productos Recomendados", href: "/products?recommended=true" }] : []),
  ],
})

// "Centro de ayuda" no cambia con el login.
const HELP_COLUMN: FooterColumn = {
  title: "Centro de ayuda",
  links: [
    { label: "Contacto", href: "/contact" },
    { label: "Preguntas Frecuentes", href: "/faq" },
    { label: "Condiciones de Despacho", href: "#" },
    { label: "Terminos y Condiciones", href: "/terms" },
  ],
}

const FooterLinkItem = ({ label, href }: FooterLink) => {
  if (label === "Condiciones de Despacho") {
    return <ShippingConditionsModal />
  }

  if (href.startsWith("/")) {
    return (
      <LocalizedClientLink href={href} className="hover:text-ui-fg-base">
        {label}
      </LocalizedClientLink>
    )
  }

  return (
    <a href={href} className="hover:text-ui-fg-base">
      {label}
    </a>
  )
}

export default async function Footer() {
  // La columna "Cuenta" (Mis Datos, Carrito, Mis pedidos) solo tiene sentido
  // si hay una sesión activa — sin login no hay datos, ni pedidos, y el
  // carrito sigue siendo accesible desde el ícono del header.
  const customer = await retrieveCustomer().catch(() => null)
  const isLoggedIn = Boolean(customer)

  // Todas las columnas, en el orden fijo que define la posición en el grid
  // de escritorio (Cuenta siempre es la primera). Sin sesión, la columna
  // Cuenta se oculta pero "Enlaces útiles" y "Centro de ayuda" deben
  // quedarse en su misma posición — no correrse un puesto a la izquierda.
  const ALL_COLUMNS = [
    ACCOUNT_COLUMN,
    buildUsefulLinksColumn(isLoggedIn),
    HELP_COLUMN,
  ]

  return (
    <footer className="bg-gray-50 border-t border-ui-border-base w-full">
      <div className="content-container flex flex-col w-full">
        {/* Desktop / tablet layout: logo on the left, columns on the right */}
        <div className="hidden small:flex items-start justify-between py-20 xsmall:py-28">
          <div>
            <LocalizedClientLink
              href="/"
              className="flex items-center shrink-0"
              data-testid="footer-store-link"
            >
              <Image
                src={SONRIE_LOGO_URL}
                alt="Sonríe Market"
                width={220}
                height={60}
                className="h-14 w-auto"
              />
            </LocalizedClientLink>
          </div>
          <div className="text-large-regular gap-x-20 gap-y-10 grid grid-cols-2 sm:grid-cols-3">
            {ALL_COLUMNS.map((column) => {
              // Sin sesión, la columna "Cuenta" se oculta pero sigue
              // ocupando su celda del grid (div vacío) para que las otras
              // dos columnas no se corran de posición.
              if (column === ACCOUNT_COLUMN && !customer) {
                return <div key={column.title} aria-hidden="true" />
              }

              return (
                <div key={column.title} className="flex flex-col gap-y-5">
                  <span className="text-large-semi uppercase text-ui-fg-base">
                    {column.title}
                  </span>
                  <ul
                    className="grid grid-cols-1 gap-4 text-ui-fg-subtle text-large-regular"
                    data-testid={`footer-column-${column.title}`}
                  >
                    {column.links.map((link) => (
                      <li key={link.label}>
                        <FooterLinkItem {...link} />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>

        {/* Mobile layout: collapsible accordion per column, logo at the bottom */}
        <div className="small:hidden">
          {ALL_COLUMNS.filter(
            (column) => column !== ACCOUNT_COLUMN || customer
          ).map((column) => (
            <details
              key={column.title}
              className="group border-b border-ui-border-base"
            >
              <summary className="flex items-center justify-between py-4 cursor-pointer list-none marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="text-base-regular text-ui-fg-base">
                  {column.title}
                </span>
                <ChevronDown className="shrink-0 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <ul
                className="flex flex-col gap-y-4 pb-4 text-ui-fg-subtle text-base-regular"
                data-testid={`footer-column-mobile-${column.title}`}
              >
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLinkItem {...link} />
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <div className="py-6">
            <LocalizedClientLink
              href="/"
              className="flex items-center shrink-0"
              data-testid="footer-store-link-mobile"
            >
              <Image
                src={SONRIE_LOGO_URL}
                alt="Sonríe Market"
                width={160}
                height={44}
                className="h-9 w-auto"
              />
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    </footer>
  )
}
