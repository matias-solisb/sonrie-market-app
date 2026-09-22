"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { useCart } from "@/lib/context/cart-context"
import { getCheckoutStep } from "@/lib/util/get-checkout-step"
import { updateCart } from "@/lib/data/cart"
import { StoreStockLocation } from "@/lib/data/stock-locations"
import CartToCsvButton from "@/modules/cart/components/cart-to-csv-button"
import CartTotals from "@/modules/cart/components/cart-totals"
import OrderNotes from "@/modules/cart/components/order-notes"
import PromotionCode from "@/modules/checkout/components/promotion-code"
import { RequestQuoteConfirmation } from "@/modules/quotes/components/request-quote-confirmation"
import { RequestQuotePrompt } from "@/modules/quotes/components/request-quote-prompt"
import { B2BCustomer } from "@/types"
import { ApprovalStatusType } from "@/types/approval"
import { ExclamationCircle } from "@medusajs/icons"
import { Container, toast } from "@medusajs/ui"
import { clx } from "@/modules/common/components/ui"

type SummaryProps = {
  customer: B2BCustomer | null
  spendLimitExceeded: boolean
  selectedStockLocation: StoreStockLocation | null
}

const Summary = ({
  customer,
  spendLimitExceeded,
  selectedStockLocation,
}: SummaryProps) => {
  const { handleEmptyCart, cart } = useCart()
  const { countryCode } = useParams()
  const router = useRouter()
  const [isConfirming, setIsConfirming] = useState(false)

  if (!cart) return null

  const checkoutStep = getCheckoutStep(cart)
  const checkoutPath = checkoutStep
    ? `/checkout?step=${checkoutStep}`
    : "/checkout"

  const isPendingApproval = cart?.approvals?.some(
    (approval) => approval?.status === ApprovalStatusType.PENDING
  )

  const isCartEmpty = !cart?.items?.length
  const isCheckoutDisabled = spendLimitExceeded || isCartEmpty

  // Al confirmar el pedido, si hay un site de retiro elegido en
  // "Seleccione las opciones de entrega", guardamos su dirección
  // (stock_location_address.address_1/city, etc.) como shipping_address
  // y billing_address del carrito ANTES de navegar al checkout — igual a
  // lo que hace el toggle "same as billing" en BillingAddress. Con esto:
  //   1. getCheckoutStep() ya no pide la dirección a mano, salta directo
  //      a delivery/pago.
  //   2. Al completar el carrito (placeOrder → sdk.store.cart.complete),
  //      Medusa copia shipping_address/billing_address al pedido, así que
  //      el order queda con la dirección del site sin código adicional.
  // El stock_location_id también queda en cart.metadata, por si otros
  // módulos (pickup-scheduling, sap-orders, etc.) necesitan saber de qué
  // site salió el pedido.
  const handleConfirm = async () => {
    if (!customer) {
      router.push(`/${countryCode}/account`)
      return
    }

    if (isCheckoutDisabled) {
      return
    }

    setIsConfirming(true)

    try {
      if (selectedStockLocation?.address) {
        const address = {
          first_name: customer.first_name || selectedStockLocation.name,
          last_name: customer.last_name || "-",
          company: selectedStockLocation.name,
          address_1: selectedStockLocation.address.address_1 || "",
          address_2: selectedStockLocation.address.address_2 || "",
          city: selectedStockLocation.address.city || "",
          province: selectedStockLocation.address.province || "",
          postal_code: selectedStockLocation.address.postal_code || "",
          country_code: (
            selectedStockLocation.address.country_code || "cl"
          ).toLowerCase(),
        }

        await updateCart({
          shipping_address: address,
          billing_address: address,
          metadata: {
            ...(cart.metadata ?? {}),
            stock_location_id: selectedStockLocation.id,
          },
        })
      }

      router.push(`/${countryCode}${checkoutPath}`)
    } catch (e) {
      toast.error(
        "No se pudo guardar el site de retiro elegido. Intenta nuevamente."
      )
      console.error("Error al guardar stock_location en cart:", e)
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="flex flex-col gap-y-3">
        <CartTotals />
      </Container>

      {/* <PromotionCode cart={cart} /> */}

      <Container>
        <OrderNotes cart={cart} />
      </Container>

      {spendLimitExceeded && (
        <div className="flex items-center gap-x-2 bg-neutral-100 p-3 rounded-md shadow-borders-base">
          <ExclamationCircle className="text-orange-500 w-fit overflow-visible" />
          <p className="text-neutral-950 text-xs">
            This order exceeds your spending limit.
            <br />
            Please contact your manager for approval.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isCheckoutDisabled || isConfirming}
        data-testid="checkout-button"
        className={clx(
          "w-full h-11 rounded-xl text-sm font-bold transition-colors",
          isCheckoutDisabled
            ? "bg-neutral-200 text-neutral-400 pointer-events-none"
            : "bg-blue-900 text-white hover:bg-blue-800"
        )}
      >
        {customer
          ? spendLimitExceeded
            ? "Spending Limit Exceeded"
            : isConfirming
            ? "Guardando..."
            : "Confirmar pedido"
          : "Log in to Checkout"}
      </button>
    </div>
  )
}

export default Summary
