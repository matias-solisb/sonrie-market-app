"use client"

import { useCart } from "@/lib/context/cart-context"
import { getCheckoutStep } from "@/lib/util/get-checkout-step"
import CartToCsvButton from "@/modules/cart/components/cart-to-csv-button"
import CartTotals from "@/modules/cart/components/cart-totals"
import OrderNotes from "@/modules/cart/components/order-notes"
import PromotionCode from "@/modules/checkout/components/promotion-code"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { RequestQuoteConfirmation } from "@/modules/quotes/components/request-quote-confirmation"
import { RequestQuotePrompt } from "@/modules/quotes/components/request-quote-prompt"
import { B2BCustomer } from "@/types"
import { ApprovalStatusType } from "@/types/approval"
import { ExclamationCircle } from "@medusajs/icons"
import { Container } from "@medusajs/ui"
import { clx } from "@/modules/common/components/ui"

type SummaryProps = {
  customer: B2BCustomer | null
  spendLimitExceeded: boolean
}

const Summary = ({ customer, spendLimitExceeded }: SummaryProps) => {
  const { handleEmptyCart, cart } = useCart()

  if (!cart) return null

  const checkoutStep = getCheckoutStep(cart)
  const checkoutPath = checkoutStep
    ? `/checkout?step=${checkoutStep}`
    : "/checkout"

  const checkoutButtonLink = customer ? checkoutPath : "/account"

  const isPendingApproval = cart?.approvals?.some(
    (approval) => approval?.status === ApprovalStatusType.PENDING
  )

  const isCartEmpty = !cart?.items?.length
  const isCheckoutDisabled = spendLimitExceeded || isCartEmpty

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
      <LocalizedClientLink
        href={checkoutButtonLink}
        data-testid="checkout-button"
      >
        <button
          type="button"
          disabled={isCheckoutDisabled}
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
              : "Confirmar pedido"
            : "Log in to Checkout"}
        </button>
      </LocalizedClientLink>
    </div>
  )
}

export default Summary
