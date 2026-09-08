"use client"

import { convertToLocale } from "@/lib/util/money"
import { ChevronLeft, ChevronRight } from "@medusajs/icons"
import { Table, Text } from "@medusajs/ui"

/*

Tabla de "Mis documentos" (boletas/DTE). A diferencia de `OrdersTable`,
acá no hay ningún dato real detrás todavía: no existe ningún módulo ni
endpoint de documentos/boletas en el backend (`dte-storage` está
especificado pero no construido, ver especificación técnica §4.5 y el
comentario que ya tenía el stub anterior de esta página). Por eso el
arreglo de documentos llega vacío desde la página — esto NO es un bug,
es el estado esperado hasta que ese módulo exista.

Se deja definida la forma de fila (`PaymentDocument`) para que, cuando se
construya `dte-storage`, quede claro qué columnas tiene que devolver el
backend para que esta tabla funcione sin cambios.

*/

export type PaymentDocument = {
  id: string
  date: string
  due_date: string | null
  document_type: string
  order_display_id: string
  document_number: string
  pending_amount: number
  currency_code: string
}

type PaymentDocumentsTableProps = {
  documents: PaymentDocument[]
}

const formatDate = (value?: string | null) => {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

const PaymentDocumentsTable = ({ documents }: PaymentDocumentsTableProps) => {
  return (
    <div
      className="flex flex-col gap-y-4 w-full"
      data-testid="payment-documents-table"
    >
      <Table>
        <Table.Header>
          {/* Ver el comentario largo sobre `!bg-neutral-100`/`!text-neutral-700
              !font-semibold` en `orders-table/index.tsx` — misma razón acá. */}
          <Table.Row className="!bg-neutral-100 hover:!bg-neutral-100">
            <Table.HeaderCell className="!text-neutral-700 !font-semibold">
              Fecha
            </Table.HeaderCell>
            <Table.HeaderCell className="!text-neutral-700 !font-semibold">
              Fecha de vencimiento
            </Table.HeaderCell>
            <Table.HeaderCell className="!text-neutral-700 !font-semibold">
              Tipo de documento
            </Table.HeaderCell>
            <Table.HeaderCell className="!text-neutral-700 !font-semibold">
              ID orden
            </Table.HeaderCell>
            <Table.HeaderCell className="!text-neutral-700 !font-semibold">
              ID documento
            </Table.HeaderCell>
            <Table.HeaderCell className="!text-neutral-700 !font-semibold">
              Valor pendiente
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {documents.map((doc) => (
            <Table.Row key={doc.id}>
              <Table.Cell>{formatDate(doc.date)}</Table.Cell>
              <Table.Cell>{formatDate(doc.due_date)}</Table.Cell>
              <Table.Cell>{doc.document_type}</Table.Cell>
              <Table.Cell>{doc.order_display_id}</Table.Cell>
              <Table.Cell>{doc.document_number}</Table.Cell>
              <Table.Cell>
                {convertToLocale({
                  amount: doc.pending_amount,
                  currency_code: doc.currency_code,
                })}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {documents.length === 0 && (
        <div
          className="w-full flex flex-col items-center gap-y-2 py-8"
          data-testid="no-documents-container"
        >
          <Text className="text-neutral-500">
            Próximamente vas a poder ver y descargar tus boletas y
            documentos de pago desde acá.
          </Text>
        </div>
      )}

      {/* Ver el comentario largo en `orders-table/index.tsx` sobre por qué
          esto no usa `Table.Pagination` de @medusajs/ui. */}
      <div className="flex items-center justify-end gap-x-3 px-1 py-2 text-sm text-neutral-500">
        <span>{documents.length === 0 ? "0-0" : `1-${documents.length}`} de {documents.length}</span>
        <div className="flex items-center gap-x-1">
          <button
            type="button"
            aria-label="Página anterior"
            disabled
            className="rounded p-1 text-neutral-400 opacity-40"
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            aria-label="Página siguiente"
            disabled
            className="rounded p-1 text-neutral-400 opacity-40"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  )
}

export default PaymentDocumentsTable
