"use client"

import { useCart } from "@/lib/context/cart-context"
import { convertToLocale } from "@/lib/util/money"
import AddNoteButton from "@/modules/cart/components/add-note-button"
import DeleteButton from "@/modules/common/components/delete-button"
import LineItemPrice from "@/modules/common/components/line-item-price"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Spinner from "@/modules/common/icons/spinner"
import Thumbnail from "@/modules/products/components/thumbnail"
import { MinusMini, PlusMini } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { clx, Container, Input } from "@medusajs/ui"
import { startTransition, useEffect, useState } from "react"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  showBorders?: boolean
  currencyCode: string
  disabled?: boolean
}

const ItemFull = ({
  item,
  showBorders = true,
  currencyCode,
  disabled,
}: ItemProps) => {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [quantity, setQuantity] = useState(item.quantity.toString())

  const { handleDeleteItem, handleUpdateCartQuantity } = useCart()

  const changeQuantity = async (newQuantity: number) => {
    setError(null)
    // setUpdating(true)

    startTransition(() => {
      setQuantity(newQuantity.toString())
    })

    await handleUpdateCartQuantity(item.id, Number(newQuantity))
  }

  useEffect(() => {
    setQuantity(item.quantity.toString())
  }, [item.quantity])

  const handleBlur = (value: number) => {
    if (value === item.quantity) {
      return
    }

    if (value > maxQuantity) {
      changeQuantity(maxQuantity)
    }

    if (value < 1) {
      setUpdating(true)
      handleDeleteItem(item.id)
      setUpdating(false)
    }

    changeQuantity(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) {
      return
    }

    if (e.key === "Enter") {
      changeQuantity(Number(quantity))
    }

    if (e.key === "ArrowUp" && e.shiftKey) {
      e.preventDefault()
      setQuantity((Number(quantity) + 10).toString())
    }

    if (e.key === "ArrowDown" && e.shiftKey) {
      e.preventDefault()
      setQuantity((Number(quantity) - 10).toString())
    }
  }

  const maxQuantity = item.variant?.inventory_quantity ?? 100

  return (
    <Container
      className={clx(
        "relative flex gap-4 w-full h-full items-center justify-between border border-gray-200",
        {
          "shadow-none border-transparent": !showBorders,
        }
      )}
    >
      <DeleteButton
        id={item.id}
        disabled={disabled}
        className="absolute top-3 right-3"
      />
      <div className="flex gap-x-4 items-start">
        <LocalizedClientLink href={`/products/${item.product_handle}`}>
          <Thumbnail
            thumbnail={item.thumbnail}
            size="square"
            type="full"
            className="bg-neutral-100 rounded-lg w-20 h-20"
          />
        </LocalizedClientLink>
        <div className="flex flex-col gap-y-2 justify-between min-h-full self-stretch">
          <div className="flex flex-col">
            <span className="text-neutral-600 text-[0.6rem]">BRAND</span>

            <span className="txt-medium-plus text-neutral-950">
              {item.product?.title}
            </span>
            <span className="text-neutral-600 text-xs">
              {item.variant?.title}
            </span>
          </div>
          <div className="flex small:flex-row flex-col gap-2">
            <LineItemPrice
              className="flex small:hidden self-start"
              item={item}
              currencyCode={currencyCode}
            />
            <div className="flex gap-x-2">
              <div
                className="flex h-10 w-64 items-stretch overflow-hidden rounded-md border border-ui-border-base"
                data-testid="cart-item-quantity"
              >
                <button
                  type="button"
                  className={clx(
                    "flex w-10 shrink-0 items-center justify-center bg-blue-900 text-white hover:bg-blue-800",
                    disabled ? "opacity-50 pointer-events-none" : "opacity-100"
                  )}
                  aria-label="Quitar una unidad"
                  onClick={() => {
                    // Con cantidad 1, "quitar una unidad" debe eliminar la
                    // línea del carrito (bajar a 0), no intentar actualizarla
                    // a cantidad 0 (el Store API de Medusa no acepta
                    // quantity: 0 en updateLineItem). Antes este botón se
                    // deshabilitaba en cantidad 1, dejando el click sin
                    // ningún efecto.
                    if (item.quantity <= 1) {
                      handleDeleteItem(item.id)
                    } else {
                      changeQuantity(item.quantity - 1)
                    }
                  }}
                  disabled={disabled}
                >
                  <MinusMini />
                </button>
                <span className="flex flex-1 items-center justify-center text-base-regular text-ui-fg-base">
                  {updating ? (
                    <Spinner size="16" />
                  ) : (
                    <Input
                      className={clx(
                        "h-full w-full flex items-center justify-center text-center text-ui-fg-base text-base-regular border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-transparent shadow-none",
                        disabled
                          ? "opacity-50 pointer-events-none"
                          : "opacity-100"
                      )}
                      type="number"
                      value={quantity}
                      onChange={(e) => {
                        setQuantity(e.target.value)
                      }}
                      onBlur={(e) => {
                        handleBlur(Number(e.target.value))
                      }}
                      onKeyDown={(e) => handleKeyDown(e)}
                      disabled={disabled}
                    />
                  )}
                </span>
                <button
                  type="button"
                  className={clx(
                    "flex w-10 shrink-0 items-center justify-center bg-blue-900 text-white hover:bg-blue-800",
                    disabled ? "opacity-50 pointer-events-none" : "opacity-100"
                  )}
                  aria-label="Agregar una unidad"
                  onClick={() => changeQuantity(item.quantity + 1)}
                  disabled={item.quantity >= maxQuantity || disabled}
                >
                  <PlusMini />
                </button>
              </div>
            </div>
            <AddNoteButton
              item={item as HttpTypes.StoreCartLineItem}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
      <div className="hidden small:flex flex-col items-end justify-center min-h-full self-stretch text-right">
        <span className="text-base-regular text-neutral-950">
          <span className="font-semibold">
            {convertToLocale({
              amount: item.total,
              currency_code: currencyCode,
            })}
          </span>{" "}
          <span className="text-xs font-normal text-neutral-500">/ Total</span>
        </span>
        <span className="text-xs text-neutral-500">
          {convertToLocale({
            amount: item.unit_price,
            currency_code: currencyCode,
          })}
          /Pack
        </span>
      </div>
    </Container>
  )
}

export default ItemFull
