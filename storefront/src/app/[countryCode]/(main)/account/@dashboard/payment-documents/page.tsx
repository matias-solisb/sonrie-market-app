import DocumentFilters from "@/modules/account/components/document-filters"
import OrdersDocumentsTabs from "@/modules/account/components/orders-documents-tabs"
import PaymentDocumentsTable, {
  PaymentDocument,
} from "@/modules/account/components/payment-documents-table"
import { Heading } from "@medusajs/ui"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Documentos de pago",
  description: "Boletas y documentos de pago de tus pedidos.",
}

// TODO: reemplazar por el fetch real cuando exista el módulo `dte-storage`
// (ver especificación técnica §4.5 y mapa técnico del proyecto). Por ahora
// no hay ningún backend de boletas/documentos, así que se deja el arreglo
// vacío a propósito — la tabla ya está lista para recibir esos datos sin
// más cambios (ver PaymentDocumentsTable).
const documents: PaymentDocument[] = []

export default async function PaymentDocuments() {
  return (
    <div className="w-full" data-testid="payment-documents-page-wrapper">
      <div className="mb-4">
        <Heading>Documentos de pago</Heading>
      </div>
      <div className="flex flex-col gap-y-4">
        <OrdersDocumentsTabs active="payment-documents" />
        <DocumentFilters />
        <PaymentDocumentsTable documents={documents} />
      </div>
    </div>
  )
}
