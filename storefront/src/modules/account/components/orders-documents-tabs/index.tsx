"use client"

import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { clx } from "@medusajs/ui"

/*

Barra de pestañas compartida entre "Mis pedidos" (/account/orders) y "Mis
documentos" (/account/payment-documents). No son dos vistas de un mismo
contenido — son dos rutas reales distintas (así ya las enlaza
`AccountMenu`) — así que son links normales, no un componente de estado.

Ojo: esto NO usa el `Tabs` de `@medusajs/ui` a propósito. Ese componente
viene con su propio look fijo (estilo "segmented control": la pestaña
activa se dibuja como una píldora con fondo blanco y sombra, ver
`node_modules/@medusajs/ui/dist/esm/components/tabs/tabs.js`), y esas
clases no se pueden pisar solo con className — la que gana en el CSS que
compila Tailwind no depende del orden en que las pongas en el JSX. La
referencia pide justo lo contrario: texto plano con una línea azul debajo
de la pestaña activa, sin fondo ni caja. Por eso es un link simple.

Para ajustar el color/grosor de la línea activa o el gris de la inactiva,
tocar `TAB_ACTIVE_CLASS`/`TAB_INACTIVE_CLASS` abajo.

*/

type TabKey = "orders" | "payment-documents"

const TABS: { key: TabKey; label: string; href: string }[] = [
  { key: "orders", label: "Mis pedidos", href: "/account/orders" },
  {
    key: "payment-documents",
    label: "Mis documentos",
    href: "/account/payment-documents",
  },
]

// `-mb-px` hace que el borde de 2px de la pestaña activa quede pegado
// exactamente sobre la línea base de 1px del contenedor (sin eso se ven
// dos líneas separadas por 1px).
const TAB_BASE_CLASS =
  "text-sm pb-3 -mb-px border-b-2 whitespace-nowrap transition-colors"
const TAB_ACTIVE_CLASS = "font-semibold text-blue-900 border-blue-900"
const TAB_INACTIVE_CLASS =
  "font-medium text-neutral-500 border-transparent hover:text-neutral-700"

const OrdersDocumentsTabs = ({ active }: { active: TabKey }) => {
  return (
    <div className="flex items-center gap-x-6 border-b border-neutral-200">
      {TABS.map((tab) => (
        <LocalizedClientLink
          key={tab.key}
          href={tab.href}
          className={clx(
            TAB_BASE_CLASS,
            tab.key === active ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS
          )}
        >
          {tab.label}
        </LocalizedClientLink>
      ))}
    </div>
  )
}

export default OrdersDocumentsTabs
