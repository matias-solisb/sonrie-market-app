"use client"

import { convertToLocale } from "@/lib/util/money"
import Divider from "@/modules/common/components/divider"
import { B2BCart, B2BOrder } from "@/types"
import { clx, Text } from "@medusajs/ui"
import React from "react"

const CheckoutTotals: React.FC<{
  cartOrOrder: B2BCart | B2BOrder
  /** Checkout de retiro: letra más grande y total en un recuadro de color. */
  highlightTotal?: boolean
}> = ({ cartOrOrder, highlightTotal = false }) => {
  if (!cartOrOrder) return null

  const {
    currency_code,
    total,
    item_subtotal,
    tax_total,
    shipping_total,
    discount_total,
    gift_card_total,
  } = cartOrOrder

  return (
    <div>
      <div
        className={clx(
          "flex flex-col gap-y-2 txt-medium text-ui-fg-subtle",
          highlightTotal && "text-base text-neutral-600"
        )}
      >
        <div className="flex items-center justify-between">
          <Text className="flex gap-x-1 items-center">
            Subtotal neto
          </Text>
          <Text
            data-testid="cart-item-subtotal"
            data-value={item_subtotal || 0}
          >
            {convertToLocale({ amount: item_subtotal ?? 0, currency_code })}
          </Text>
        </div>
        {!!discount_total && (
          <div className="flex items-center justify-between">
            <Text>Descuento</Text>
            <Text
              className="text-ui-fg-interactive"
              data-testid="cart-discount"
              data-value={discount_total || 0}
            >
              -{" "}
              {convertToLocale({ amount: discount_total ?? 0, currency_code })}
            </Text>
          </div>
        )}
        <div className="flex items-center justify-between">
          <Text>Retiro</Text>
          <Text data-testid="cart-shipping" data-value={shipping_total || 0}>
            {convertToLocale({ amount: shipping_total ?? 0, currency_code })}
          </Text>
        </div>
        <div className="flex justify-between">
          <Text className="flex gap-x-1 items-center ">IVA</Text>
          <Text data-testid="cart-taxes" data-value={tax_total || 0}>
            {convertToLocale({ amount: tax_total ?? 0, currency_code })}
          </Text>
        </div>
        {!!gift_card_total && (
          <div className="flex items-center justify-between">
            <Text>Gift card</Text>
            <Text
              className="text-ui-fg-interactive"
              data-testid="cart-gift-card-amount"
              data-value={gift_card_total || 0}
            >
              -{" "}
              {convertToLocale({ amount: gift_card_total ?? 0, currency_code })}
            </Text>
          </div>
        )}
      </div>
      {!highlightTotal && <Divider className="my-2" />}
      <div
        className={clx(
          "flex items-center justify-between text-ui-fg-base mb-2 txt-medium",
          highlightTotal &&
            "mb-0 mt-4 rounded-xl bg-[#FBF8F4] px-4 py-4 text-neutral-900"
        )}
      >
        <Text className={clx("font-medium", highlightTotal && "text-base font-semibold")}>
          Total (IVA incluido)
        </Text>
        <Text
          className={clx(
            "txt-xlarge-plus",
            highlightTotal && "text-2xl font-bold text-neutral-900"
          )}
          data-testid="cart-total"
          data-value={total || 0}
        >
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </Text>
      </div>
    </div>
  )
}

export default CheckoutTotals
