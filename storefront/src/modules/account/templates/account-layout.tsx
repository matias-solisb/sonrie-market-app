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

  const { carts_with_approvals } = await listApprovals({
    type: ApprovalType.ADMIN,
    status: ApprovalStatusType.PENDING,
  })

  const numPendingApprovals = carts_with_approvals?.length || 0

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
