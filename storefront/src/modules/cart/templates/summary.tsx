"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { useCart } from "@/lib/context/cart-context"
import { convertToLocale } from "@/lib/util/money"
import { setCartPickupSite } from "@/lib/data/cart"
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

  const isPendingApproval = cart?.approvals?.some(
    (approval) => approval?.status === ApprovalStatusType.PENDING
  )

  const isCartEmpty = !cart?.items?.length
  const isCheckoutDisabled = spendLimitExceeded || isCartEmpty

  // Al confirmar el pedido se elige el site de retiro en el backend
  // (setCartPickupSite → POST /store/carts/:id/pickup-site): el carrito pasa
  // al canal de venta del site, queda con su dirección, el correo del
  // colaborador y la opción "Retiro en {site}". Si algún producto no tiene
  // stock suficiente en ese site, se avisa y no se avanza al checkout.
  //
  const handleConfirm = async () => {
    if (!customer) {
      router.push(`/${countryCode}/account`)
      return
    }

    if (isCheckoutDisabled || isConfirming) {
      return
    }

    if (!selectedStockLocation) {
      toast.error("Elige un site de retiro para continuar.")
      return
    }

    setIsConfirming(true)

    try {
      const { unavailable_items } = await setCartPickupSite(
        selectedStockLocation.id
      )

      if (unavailable_items.length) {
        const detalle = unavailable_items
          .map((i) => `${i.title} (quedan ${i.available})`)
          .join(", ")

        toast.error(
          `No hay stock suficiente en ${selectedStockLocation.name} para: ${detalle}. Ajusta las cantidades o elige otro site.`
        )
        return
      }

      // El checkout es una sola página: ya no hay ?step=.
      router.push(`/${countryCode}/checkout`)
    } catch (e) {
      toast.error(
        "No se pudo guardar el site de retiro elegido. Intenta nuevamente."
      )
      console.error("Error al elegir el site de retiro:", e)
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="flex flex-col gap-y-3">
        <CartTotals benefitBudget={customer?.benefit_budget ?? null} />
      </Container>

      {/* <PromotionCode cart={cart} /> */}

      <Container>
        <OrderNotes cart={cart} />
      </Container>

      {spendLimitExceeded && (
        <div className="flex items-center gap-x-2 bg-neutral-100 p-3 rounded-md shadow-borders-base">
          <ExclamationCircle className="text-orange-500 w-fit overflow-visible" />
          <p className="text-neutral-950 text-xs">
            El pedido supera tu saldo de beneficio disponible (
            {convertToLocale({
              amount: customer?.benefit_budget?.disponible ?? 0,
              currency_code: cart.currency_code,
            })}
            ). Quita productos para continuar.
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
            ? "Saldo insuficiente"
            : isConfirming
            ? "Guardando..."
            : "Confirmar pedido"
          : "Log in to Checkout"}
      </button>
    </div>
  )
}

export default Summary
