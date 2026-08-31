import { listApprovals } from "@/lib/data/approvals"
import AccountNav from "@/modules/account/components/account-nav"
import { B2BCustomer } from "@/types"
import { ApprovalStatusType, ApprovalType } from "@/types/approval"
import React from "react"

interface AccountLayoutProps {
  customer: B2BCustomer | null
  children: React.ReactNode
}

const AccountLayout: React.FC<AccountLayoutProps> = async ({
  customer,
  children,
}) => {
  // Sin sesión (vista de login): nada de sidebar de navegación — se centra
  // el contenido en toda la pantalla en vez de vivir apretado en la
  // columna derecha de la grilla del dashboard.
  if (!customer) {
    return (
      <div
        className="flex min-h-[70vh] w-full flex-1 items-center justify-center"
        data-testid="account-page"
      >
        {children}
      </div>
    )
  }

  // El endpoint de aprobaciones "admin" (type: ADMIN) el backend lo rechaza
  // con 403 si el cliente logueado no es admin de su empresa — y AccountNav
  // ya solo muestra el link/badge de Approvals cuando
  // customer.employee?.is_admin es true. Antes se pedía este listado para
  // cualquier cliente logueado y, al no estar en un try/catch, un cliente
  // no-admin (403) tiraba abajo toda la página del dashboard. Ahora: solo
  // se pide si es admin, y de todos modos queda cubierto por si el
  // endpoint falla por otra razón (backend caído, etc.).
  const numPendingApprovals = customer.employee?.is_admin
    ? await listApprovals({
        type: ApprovalType.ADMIN,
        status: ApprovalStatusType.PENDING,
      })
        .then(({ carts_with_approvals }) => carts_with_approvals?.length || 0)
        .catch(() => 0)
    : 0

  return (
    <div className="flex-1 small:py-12" data-testid="account-page">
      <div className="flex-1 content-container h-full max-w-5xl mx-auto bg-white flex flex-col">
        <div className="grid grid-cols-1 small:grid-cols-[240px_1fr] py-12">
          <div>
            <AccountNav
              customer={customer}
              numPendingApprovals={numPendingApprovals}
            />
          </div>
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default AccountLayout
