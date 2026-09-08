import { listApprovals } from "@/lib/data/approvals"
import { retrieveCompany } from "@/lib/data/companies"
import { retrieveCustomer } from "@/lib/data/customer"
import { listOrdersWithCount } from "@/lib/data/orders"
import DocumentFilters from "@/modules/account/components/document-filters"
import OrdersDocumentsTabs from "@/modules/account/components/orders-documents-tabs"
import OrdersTable from "@/modules/account/components/orders-table"
import PendingCustomerApprovals from "@/modules/account/components/pending-customer-approvals"
import { ApprovalStatusType } from "@/types/approval"
import { Heading } from "@medusajs/ui"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Orders",
  description: "Overview of your previous orders.",
}

const PAGE_SIZE = 10

export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const currentPage = Math.max(Number(params.page) || 1, 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  // "Buscar Documentos" / "Fecha desde" / "Fecha hasta" viven en la
  // query-string (ver DocumentFilters) y se pasan tal cual al Store API de
  // órdenes — la búsqueda de texto libre no tiene un campo directo en el
  // endpoint de órdenes, así que por ahora se deja preparada la fecha
  // (que sí es un filtro nativo) y se ignora "q" hasta definir contra qué
  // campo debería buscar (display_id, dirección, etc.).
  const dateFilters: Record<string, any> = {}
  if (params.from) {
    dateFilters["created_at[$gte]"] = params.from
  }
  if (params.to) {
    dateFilters["created_at[$lte]"] = params.to
  }

  const customer = await retrieveCustomer()
  const { orders, count } = await listOrdersWithCount(PAGE_SIZE, offset, dateFilters)

  // El panel de "Pending Approvals" es solo para employees con rol
  // company_admin (ver ensureRole("company_admin") en
  // backend/src/api/store/approvals/middlewares.ts). Un customer sin
  // company (company_id undefined) o sin ese rol recibe un error del
  // backend acá — no debe tumbar el resto de la página, que sí tiene
  // que mostrar sus propios pedidos sin restricción.
  const companyId = customer?.employee?.company_id

  const { approval_settings } =
    (companyId ? await retrieveCompany(companyId).catch(() => null) : null) ||
    {}

  const approval_required =
    approval_settings?.requires_admin_approval ||
    approval_settings?.requires_sales_manager_approval

  const { carts_with_approvals } = await listApprovals({
    status: ApprovalStatusType.PENDING,
  }).catch(() => ({ carts_with_approvals: [] }))

  return (
    <div
      className="w-full flex flex-col gap-y-4"
      data-testid="orders-page-wrapper"
    >
      <div className="mb-4">
        <Heading>Orders</Heading>
      </div>
      {approval_required && (
        <div>
          <Heading level="h2" className="text-neutral-700 mb-4">
            Pending Approvals
          </Heading>

          <PendingCustomerApprovals cartsWithApprovals={carts_with_approvals} />
        </div>
      )}
      <div className="flex flex-col gap-y-4">
        <OrdersDocumentsTabs active="orders" />
        <DocumentFilters />
        <OrdersTable
          orders={orders}
          count={count}
          pageSize={PAGE_SIZE}
          currentPage={currentPage}
        />
      </div>
    </div>
  )
}
