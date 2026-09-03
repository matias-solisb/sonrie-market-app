"use client"

import { useCart } from "@/lib/context/cart-context"
import { convertToLocale } from "@/lib/util/money"
import Divider from "@/modules/common/components/divider"
import { Text } from "@medusajs/ui"
import React from "react"

const CartTotals: React.FC = () => {
  const { isUpdatingCart, cart } = useCart()

  if (!cart) return null

  const {
    currency_code,
    total,
    item_subtotal,
    subtotal,
    tax_total,
    discount_total,
  } = cart

  /*
  Seccion de Facturacion
  neto, descuento, subtotal, impuestos, total
  */
  return (
    <div>
      <h1 className="text-lg font-semibold text-neutral-950 mb-3">
        Facturación:
      </h1>

      <div className="flex flex-col gap-y-2">
        <div className="flex items-center justify-between">
          <Text className="text-neutral-500">Neto:</Text>
          <Text
            className="text-neutral-950"
            data-testid="cart-item-subtotal"
            data-value={item_subtotal || 0}
          >
            {convertToLocale({ amount: item_subtotal ?? 0, currency_code })}
          </Text>
        </div>

        <div className="flex items-center justify-between">
          <Text className="text-neutral-500">Descuento:</Text>
          <Text
            className="text-neutral-950"
            data-testid="cart-discount"
            data-value={discount_total || 0}
          >
            {convertToLocale({ amount: discount_total ?? 0, currency_code })}
          </Text>
        </div>

        <div className="flex items-center justify-between">
          <Text className="font-semibold text-neutral-950">Subtotal:</Text>
          <Text
            className="font-semibold text-neutral-950"
            data-testid="cart-subtotal"
            data-value={subtotal || 0}
          >
            {convertToLocale({ amount: subtotal ?? 0, currency_code })}
          </Text>
        </div>
      </div>

      <Divider className="my-3" />

      <div className="flex items-center justify-between mb-6">
        <Text className="text-neutral-500">Impuestos:</Text>
        <Text data-testid="cart-taxes" data-value={tax_total || 0}>
          {convertToLocale({ amount: tax_total ?? 0, currency_code })}
        </Text>
      </div>

      <div className="flex items-center justify-between">
        <Text className="font-semibold text-neutral-950">Total:</Text>
        {isUpdatingCart ? (
          <div className="w-28 h-6 mt-[3px] bg-neutral-200 rounded-full animate-pulse" />
        ) : (
          <Text
            className="font-semibold text-neutral-950"
            data-testid="cart-total"
            data-value={total || 0}
          >
            {convertToLocale({ amount: total ?? 0, currency_code })}
          </Text>
        )}
      </div>

      {/* Placeholder estático hasta conectar el cupo real del colaborador
      (customer.employee.spending_limit, ver lib/util/check-spending-limit.ts) */}
      <Text className="text-xs text-neutral-500 mt-3">
        Recuerda que llevas disponible{" "}
        <span className="font-semibold">$50.000</span> en tu línea de
        crédito.
      </Text>
    </div>
  )
}

export default CartTotals
