import { getMissingProfileFields, joinLabels } from "@/lib/util/profile-completion"
import OrderCard from "@/modules/account/components/order-card"
import PreviouslyPurchasedProducts from "@/modules/account/components/previously-purchased"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { B2BCustomer } from "@/types/global"
import { HttpTypes } from "@medusajs/types"
import { Heading } from "@medusajs/ui"

type OverviewProps = {
  customer: B2BCustomer | null
  orders: HttpTypes.StoreOrder[] | null
  region?: HttpTypes.StoreRegion | null
}

const Overview = ({ customer, orders }: OverviewProps) => {
  const missing = getMissingProfileFields(customer)

  return (
    <div data-testid="overview-page-wrapper">
      <div className="hidden small:block">
        <div className="text-xl-semi flex justify-between items-center mb-4">
          <span data-testid="welcome-message" data-value={customer?.first_name}>
            Hello {customer?.first_name}
          </span>
          <span className="text-small-regular text-ui-fg-base">
            Signed in as:{" "}
            <span
              className="font-semibold"
              data-testid="customer-email"
              data-value={customer?.email}
            >
              {customer?.email}
            </span>
          </span>
        </div>
        <div className="flex flex-col gap py-8 border-t border-gray-200">
          <div className="flex flex-col gap-y-8 h-full col-span-1 row-span-2 flex-1">
            {/* Estado del perfil con la regla de lib/util/profile-completion.ts.
                Reemplaza el "% completado" y el contador de direcciones del
                B2B Starter: en Sonríe no hay facturación ni despacho (se
                retira en un site), así que no aplican. */}
            <div className="flex flex-col gap-y-2 mb-6">
              <h3 className="text-large-semi">Perfil</h3>
              <span
                className="text-base-regular"
                data-testid="customer-profile-status"
                data-value={missing.length ? "incompleto" : "completo"}
              >
                {missing.length === 0 ? (
                  "Completo"
                ) : (
                  <>
                    Falta: <b>{joinLabels(missing)}</b>
                    {missing.some((f) => f.editable) && (
                      <>
                        {" · "}
                        <LocalizedClientLink
                          href="/account/profile"
                          className="font-semibold text-blue-900 underline underline-offset-2"
                        >
                          Completar
                        </LocalizedClientLink>
                      </>
                    )}
                  </>
                )}
              </span>
            </div>

            <div className="flex flex-col gap-y-4">
              <div className="flex items-center gap-x-2">
                <Heading level="h3" className="text-xl text-neutral-950">
                  Recent orders
                </Heading>
              </div>
              <div
                className="flex flex-col gap-y-2"
                data-testid="orders-wrapper"
              >
                {orders && orders.length > 0 ? (
                  orders
                    .slice(0, 5)
                    .map((order) => <OrderCard order={order} key={order.id} />)
                ) : (
                  <span data-testid="no-orders-message">No recent orders</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-y-4">
              <div className="flex items-center gap-x-2">
                <Heading level="h3" className="text-xl text-neutral-950">
                  Previously purchased items
                </Heading>
              </div>
              <div
                className="flex flex-col gap-y-2"
                data-testid="previously-purchased-items-wrapper"
              >
                {orders && orders.length > 0 ? (
                  <PreviouslyPurchasedProducts orders={orders} />
                ) : (
                  <span data-testid="no-previously-purchased-items-message">
                    No previously purchased items
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Overview
