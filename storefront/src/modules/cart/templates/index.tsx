"use client"

import { useCart } from "@/lib/context/cart-context"
import { exceedsBenefitBudget } from "@/lib/util/check-benefit-budget"
import { StoreStockLocation } from "@/lib/data/stock-locations"
import ApprovalStatusBanner from "@/modules/cart/components/approval-status-banner"
import DeliveryOptions from "@/modules/cart/components/delivery-options"
import EmptyCartMessage from "@/modules/cart/components/empty-cart-message"
import SignInPrompt from "@/modules/cart/components/sign-in-prompt"
import ItemsTemplate from "@/modules/cart/templates/items"
import Summary from "@/modules/cart/templates/summary"
import { B2BCustomer } from "@/types/global"
import { useMemo, useState } from "react"

const CartTemplate = ({
  customer,
  stockLocations,
}: {
  customer: B2BCustomer | null
  stockLocations: StoreStockLocation[]
}) => {
  const { cart } = useCart()

  const spendLimitExceeded = useMemo(
    () => exceedsBenefitBudget(cart, customer),
    [cart, customer]
  )

  // Site de retiro elegido en "Seleccione las opciones de entrega". Vive
  // acá (no en cart-context) porque solo se usa en esta página: al hacer
  // clic en "Confirmar pedido", Summary lo envía al backend
  // (setCartPickupSite) antes de entrar al checkout.
  //
  // Arranca en el site que el carrito ya tiene guardado
  // (`metadata.stock_location_id`, si el colaborador volvió desde el
  // checkout) y, si no hay, en el primero de la lista. Antes arrancaba
  // siempre en el primero: al volver al carrito y confirmar de nuevo sin
  // mirar, el pedido salía para otro site.
  const savedStockLocationId = cart?.metadata?.stock_location_id as
    | string
    | undefined
  const [selectedStockLocationId, setSelectedStockLocationId] = useState<
    string | null
  >(
    stockLocations.some((location) => location.id === savedStockLocationId)
      ? savedStockLocationId!
      : stockLocations[0]?.id ?? null
  )

  const selectedStockLocation =
    stockLocations.find(
      (location) => location.id === selectedStockLocationId
    ) || null

  return (
    <div className="small:pb-12 py-6 bg-neutral-100">
      <div className="content-container" data-testid="cart-container">
        {cart ? (
          <div>
            <div className="flex flex-col gap-y-6">
              <div className="grid grid-cols-1 small:grid-cols-[1fr_360px] gap-2">
                <div className="flex flex-col gap-y-2">
                  <DeliveryOptions
                    stockLocations={stockLocations}
                    selectedStockLocationId={selectedStockLocationId}
                    onChangeStockLocation={setSelectedStockLocationId}
                  />
                  {!customer && <SignInPrompt />}
                  {cart?.approvals && cart.approvals.length > 0 && (
                    <ApprovalStatusBanner cart={cart} />
                  )}
                  <ItemsTemplate cart={cart} />
                </div>
                <div className="relative">
                  <div className="flex flex-col gap-y-8 sticky top-20">
                    {cart && cart.region && (
                      <Summary
                        customer={customer}
                        spendLimitExceeded={spendLimitExceeded}
                        selectedStockLocation={selectedStockLocation}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <EmptyCartMessage />
          </div>
        )}
      </div>
    </div>
  )
}

export default CartTemplate
