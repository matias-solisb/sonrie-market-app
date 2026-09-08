"use client"

import { convertToLocale } from "@/lib/util/money"
import { getOrderStatusLabel } from "@/lib/util/order-status-labels"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { ChevronLeft, ChevronRight } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Table, Text } from "@medusajs/ui"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/*

Tabla de "Mis pedidos" (reemplaza el listado de tarjetas
`OrderOverview`/`OrderCard`). Todas las columnas salen de datos que Medusa
ya expone en la orden — no hay ningún campo inventado acá:

- Fecha pedido → order.created_at
- Fecha de entrega → order.fulfillments[0]?.delivered_at (el flujo de
  retiro/click&collect todavía no está construido, así que hoy va a venir
  vacío para casi todos los pedidos — eso es correcto, no un mock)
- ID del pedido → order.display_id
- Dirección → order.shipping_address
- Valor → order.total / order.currency_code
- Estado → order.fulfillment_status / order.status, vía
  `getOrderStatusLabel`

*/

const PAGE_PARAM = "page"

type OrdersTableProps = {
  orders: HttpTypes.StoreOrder[]
  count: number
  pageSize: number
  currentPage: number
}

const formatDate = (value?: string | Date | null) => {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

const formatAddress = (
  address?: HttpTypes.StoreOrder["shipping_address"]
) => {
  if (!address) return "—"
  return [address.address_1, address.city].filter(Boolean).join(", ") || "—"
}

const OrdersTable = ({
  orders,
  count,
  pageSize,
  currentPage,
}: OrdersTableProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const pageCount = Math.max(Math.ceil(count / pageSize), 1)
  const pageIndex = currentPage - 1

  const goToPage = (index: number) => {
    const params = new URLSearchParams(searchParams)
    params.set(PAGE_PARAM, String(index + 1))
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-y-4 w-full" data-testid="orders-table">
      <Table>
        <Table.Header>
          {/*
            `!bg-neutral-100` va con `!` a propósito: `Table.Row` ya trae
            `bg-ui-bg-base` fijo y `Table.Header` pisa eso encima con un
            selector `[&_tr]:bg-ui-bg-subtle` — ninguno de los dos es
            "important", así que cuál gana depende del orden interno en que
            Tailwind arma su hoja de estilos, no del orden de las clases acá.
            Lo único que gana siempre, sin adivinar ese orden, es marcar la
            propia como important. Mismo motivo para `!text-neutral-700
            !font-semibold` en cada `Table.HeaderCell` (el texto por
            defecto sale gris clarito vía `text-ui-fg-subtle` del `Table`
            raíz).
          */}
          <Table.Row className="!bg-neutral-100 hover:!bg-neutral-100">
            <Table.HeaderCell className="!text-neutral-700 !font-semibold">
              Fecha pedido
            </Table.HeaderCell>
            <Table.HeaderCell className="!text-neutral-700 !font-semibold">
              Fecha de entrega
            </Table.HeaderCell>
            <Table.HeaderCell className="!text-neutral-700 !font-semibold">
              ID del pedido
            </Table.HeaderCell>
            <Table.HeaderCell className="!text-neutral-700 !font-semibold">
              Dirección
            </Table.HeaderCell>
            <Table.HeaderCell className="!text-neutral-700 !font-semibold">
              Valor
            </Table.HeaderCell>
            <Table.HeaderCell className="!text-neutral-700 !font-semibold">
              Estado
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {orders.map((order) => (
            <Table.Row
              key={order.id}
              className="cursor-pointer [&_td]:last:w-[1%] [&_td]:last:whitespace-nowrap"
            >
              <Table.Cell>
                <LocalizedClientLink
                  href={`/account/orders/details/${order.id}`}
                  className="block"
                >
                  {formatDate(order.created_at)}
                </LocalizedClientLink>
              </Table.Cell>
              <Table.Cell>
                {formatDate(order.fulfillments?.[0]?.delivered_at)}
              </Table.Cell>
              <Table.Cell>#{order.display_id}</Table.Cell>
              <Table.Cell>{formatAddress(order.shipping_address)}</Table.Cell>
              <Table.Cell>
                {convertToLocale({
                  amount: order.total,
                  currency_code: order.currency_code,
                })}
              </Table.Cell>
              <Table.Cell>{getOrderStatusLabel(order)}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {orders.length === 0 && (
        <div
          className="w-full flex flex-col items-center gap-y-2 py-8"
          data-testid="no-orders-container"
        >
          <Text className="text-neutral-500">
            Aún no tienes pedidos para mostrar.
          </Text>
        </div>
      )}

      {/*
        No se usa `Table.Pagination` de `@medusajs/ui` a propósito: su
        markup viene fijo con dos bloques de texto ("X - Y of Z results" y
        "página X de Y") más botones "Prev"/"Next" con texto — no hay props
        para sacar esas partes, solo para traducir las palabras (ver
        `node_modules/@medusajs/ui/dist/esm/components/table/table.js`).
        La referencia es mucho más simple: "0-0 de 0" + flechas. Así que
        esto es un bloque propio con exactamente esas piezas.
      */}
      <div className="flex items-center justify-end gap-x-3 px-1 py-2 text-sm text-neutral-500">
        <span>
          {count === 0
            ? "0-0"
            : `${pageIndex * pageSize + 1}-${Math.min(
                count,
                (pageIndex + 1) * pageSize
              )}`}{" "}
          de {count}
        </span>
        <div className="flex items-center gap-x-1">
          <button
            type="button"
            aria-label="Página anterior"
            disabled={pageIndex <= 0}
            onClick={() => goToPage(Math.max(pageIndex - 1, 0))}
            className="rounded p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-40 disabled:hover:text-neutral-400"
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            aria-label="Página siguiente"
            disabled={pageIndex >= pageCount - 1}
            onClick={() => goToPage(Math.min(pageIndex + 1, pageCount - 1))}
            className="rounded p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-40 disabled:hover:text-neutral-400"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  )
}

export default OrdersTable
