"use client"

import {
  addToCart,
  deleteLineItem,
  retrieveCart,
  updateLineItem,
} from "@/lib/data/cart"
import { MinusMini, PlusMini } from "@medusajs/icons"
import { useState, useTransition } from "react"

type AddToCartStepperProps = {
  variantId: string
  countryCode: string
  initialQuantity?: number
  initialLineItemId?: string
  // Ancho del control. Las cards del catálogo quieren que ocupe todo el
  // ancho disponible; la página de detalle de producto lo quiere angosto
  // (ver modules/products/templates/index.tsx). Default: ancho completo.
  className?: string
}

// Botón de "agregar" que se convierte en un stepper (- cantidad +) una vez
// que la variante por defecto del producto ya está en el carrito. Después de
// cada mutación se vuelve a leer el carrito para quedar sincronizado con el
// id real del line item (necesario para poder subir/bajar cantidad o
// eliminarlo después).
const AddToCartStepper = ({
  variantId,
  countryCode,
  initialQuantity = 0,
  initialLineItemId,
  className = "w-full",
}: AddToCartStepperProps) => {
  const [quantity, setQuantity] = useState(initialQuantity)
  const [lineItemId, setLineItemId] = useState(initialLineItemId)
  const [isPending, startTransition] = useTransition()

  const syncFromCart = async () => {
    const cart = await retrieveCart()
    const item = cart?.items?.find((i) => i.variant_id === variantId)
    setLineItemId(item?.id)
    setQuantity(item?.quantity ?? 0)
  }

  const handleIncrement = () => {
    startTransition(async () => {
      try {
        if (!lineItemId) {
          await addToCart({ variantId, quantity: 1, countryCode })
        } else {
          await updateLineItem({
            lineId: lineItemId,
            data: { quantity: quantity + 1 },
          })
        }
        await syncFromCart()
      } catch (error) {
        console.error("No se pudo agregar el producto al carrito", error)
      }
    })
  }

  const handleDecrement = () => {
    if (!lineItemId) {
      return
    }

    startTransition(async () => {
      try {
        if (quantity <= 1) {
          await deleteLineItem(lineItemId)
          setLineItemId(undefined)
          setQuantity(0)
        } else {
          await updateLineItem({
            lineId: lineItemId,
            data: { quantity: quantity - 1 },
          })
          await syncFromCart()
        }
      } catch (error) {
        console.error("No se pudo actualizar el carrito", error)
      }
    })
  }

  if (quantity < 1) {
    return (
      <button
        type="button"
        onClick={handleIncrement}
        disabled={isPending}
        className={`flex h-10 items-center justify-center gap-x-2 rounded-md bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-60 ${className}`}
        data-testid="add-to-cart-button"
      >
        <PlusMini />
        Agregar
      </button>
    )
  }

  return (
    <div
      className={`flex h-10 items-stretch overflow-hidden rounded-md border border-ui-border-base ${className}`}
      data-testid="cart-quantity-stepper"
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={isPending}
        aria-label="Quitar una unidad"
        className="flex w-10 shrink-0 items-center justify-center bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-60"
      >
        <MinusMini />
      </button>
      <span
        className="flex flex-1 items-center justify-center text-base-regular text-ui-fg-base"
        data-testid="cart-quantity-value"
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={handleIncrement}
        disabled={isPending}
        aria-label="Agregar una unidad"
        className="flex w-10 shrink-0 items-center justify-center bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-60"
      >
        <PlusMini />
      </button>
    </div>
  )
}

export default AddToCartStepper
