"use client"

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react"
import {
  ExclamationCircle,
  ShoppingCart,
  Spinner,
  Trash,
  XMark,
} from "@medusajs/icons"
import { convertToLocale } from "@/lib/util/money"
import { deleteLineItem } from "@/lib/data/cart"
import { B2BCart } from "@/types/global"
import { Button, clx } from "@/modules/common/components/ui"
import AddToCartStepper from "@/modules/products/components/product-preview/add-to-cart-stepper"
import LineItemOptions from "@/modules/common/components/line-item-options"
import LineItemPrice from "@/modules/common/components/line-item-price"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Thumbnail from "@/modules/products/components/thumbnail"
import { useParams, usePathname } from "next/navigation"
import { Fragment, useEffect, useRef, useState, useTransition } from "react"

// DeleteButton propio del diseño original (idéntico visualmente al de
// sonrie-market: icono Trash/Spinner + texto "Remove"). No se reutiliza el
// DeleteButton real del B2B Starter (@/modules/common/components/delete-button)
// porque ese usa useCart() (@/lib/context/cart-context), que exige un
// <CartProvider> ancestro — y este dropdown vive en el header, fuera de
// cualquier CartProvider (solo se monta en la página /cart y en
// modules/cart/components/cart-button), así que llamarlo acá rompería en
// runtime con "useCart must be used within a CartProvider". En su lugar, y
// tal como ya hacía el propio componente del diseño, se llama a
// deleteLineItem() directamente (misma función standalone que usa
// add-to-cart-stepper.tsx) con estado local.
const CartItemDeleteButton = ({
  id,
  children,
  className,
}: {
  id: string
  children?: React.ReactNode
  className?: string
}) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const [, startTransition] = useTransition()

  const handleDelete = (lineId: string) => {
    setIsDeleting(true)
    startTransition(async () => {
      try {
        await deleteLineItem(lineId)
      } catch (error) {
        console.error("No se pudo eliminar el producto del carrito", error)
        setIsDeleting(false)
      }
    })
  }

  return (
    <div
      className={clx(
        "flex items-center justify-between text-small-regular",
        className
      )}
    >
      <button
        className="flex gap-x-1 text-orange-500 hover:text-orange-600 cursor-pointer"
        onClick={() => handleDelete(id)}
        data-testid="cart-item-remove-button"
        aria-label="Eliminar producto"
      >
        {isDeleting ? <Spinner className="animate-spin" /> : <Trash />}
        {children && <span>{children}</span>}
      </button>
    </div>
  )
}

const CartDropdown = ({
  cart: cartState,
}: {
  cart?: B2BCart | null
}) => {
  const [activeTimer, setActiveTimer] = useState<NodeJS.Timer | undefined>(
    undefined
  )
  const [cartDropdownOpen, setCartDropdownOpen] = useState(false)

  const open = () => setCartDropdownOpen(true)
  const close = () => setCartDropdownOpen(false)

  const totalItems =
    cartState?.items?.reduce((acc, item) => {
      return acc + item.quantity
    }, 0) || 0

  const subtotal = cartState?.subtotal ?? 0
  const currencyCode = cartState?.currency_code ?? "clp"
  const cartAmount = cartState?.currency_code
    ? convertToLocale({
        amount: subtotal,
        currency_code: cartState.currency_code,
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      })
    : "$0"
  const amountMissingForMinimum = Math.max(
    20000 - subtotal,
    0
  )
  const itemRef = useRef<number>(totalItems || 0)
  const { countryCode } = useParams() as { countryCode: string }

  const timedOpen = () => {
    open()

    const timer = setTimeout(close, 5000)

    setActiveTimer(timer)
  }

  const toggleDropdown = () => {
    if (activeTimer) {
      clearTimeout(activeTimer)
      setActiveTimer(undefined)
    }

    setCartDropdownOpen((prev) => !prev)
  }

  // Clean up the timer when the component unmounts
  useEffect(() => {
    return () => {
      if (activeTimer) {
        clearTimeout(activeTimer)
      }
    }
  }, [activeTimer])

  // Lock background scroll while the cart panel is open
  useEffect(() => {
    if (cartDropdownOpen) {
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"

      return () => {
        document.body.style.overflow = previousOverflow
      }
    }
  }, [cartDropdownOpen])

  const pathname = usePathname()

  // open cart dropdown when modifying the cart items, but only if we're not on the cart page
  useEffect(() => {
    if (itemRef.current !== totalItems && !pathname.includes("/cart")) {
      timedOpen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalItems, itemRef.current])

  // Close the cart panel whenever the user navigates to a different page
  useEffect(() => {
    if (activeTimer) {
      clearTimeout(activeTimer)
      setActiveTimer(undefined)
    }
    close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <div className="h-full z-50">
      <Popover className="relative h-full">
        <PopoverButton className="h-full">
          <LocalizedClientLink
            className="flex items-center gap-x-2 text-ui-fg-base hover:text-ui-fg-subtle"
            href="/cart"
            data-testid="nav-cart-link"
            onClick={(e) => {
              e.preventDefault()
              toggleDropdown()
            }}
          >
            <span className="relative flex items-center">
              <ShoppingCart />
              {totalItems > 0 && (
                <span
                  className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-900 px-1 text-[10px] font-semibold text-white"
                  data-testid="nav-cart-count"
                >
                  {totalItems}
                </span>
              )}
            </span>
            <span data-testid="nav-cart-amount">{cartAmount}</span>
          </LocalizedClientLink>
        </PopoverButton>
        <Transition
          show={cartDropdownOpen}
          as={Fragment}
          enter="transition-opacity ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 z-[60] bg-gray-900/50"
            onClick={close}
            data-testid="cart-dropdown-backdrop"
            aria-hidden="true"
          />
        </Transition>
        <Transition
          show={cartDropdownOpen}
          as={Fragment}
          enter="transition ease-out duration-300"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="transition ease-in duration-200"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
        >
          <PopoverPanel
            static
            className="fixed inset-y-0 right-0 z-[61] flex h-full w-full flex-col bg-white text-ui-fg-base shadow-xl sm:w-[520px]"
            data-testid="nav-cart-dropdown"
          >
            <div className="p-6 flex items-center justify-between border-b border-gray-200">
              <h3 className="text-large-semi">
                Mi Carrito - {totalItems} Productos
              </h3>
              <button
                onClick={close}
                className="text-ui-fg-subtle hover:text-ui-fg-base"
                data-testid="close-cart-dropdown-button"
                aria-label="Close cart"
              >
                <XMark />
              </button>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              {cartState && cartState.items?.length ? (
                <div className="flex-1 min-h-0 overflow-y-auto px-4 grid grid-cols-1 gap-y-4 content-start no-scrollbar p-px">
                  {cartState.items
                    .sort((a, b) => {
                      return (a.created_at ?? "") > (b.created_at ?? "")
                        ? -1
                        : 1
                    })
                    .map((item) => (
                      <div
                        className="flex flex-col gap-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                        key={item.id}
                        data-testid="cart-item"
                      >
                        <div className="grid grid-cols-[96px_1fr] gap-x-4">
                          <LocalizedClientLink
                            href={`/products/${item.product_handle}`}
                            className="w-24"
                          >
                            <Thumbnail
                              thumbnail={item.thumbnail}
                              images={item.variant?.product?.images}
                              size="square"
                            />
                          </LocalizedClientLink>
                          <div className="flex flex-col justify-between gap-y-3 flex-1">
                            <div className="flex items-start justify-between gap-x-2">
                              <div className="flex flex-col overflow-ellipsis whitespace-nowrap mr-4 w-[180px]">
                                <h3 className="text-base-regular overflow-hidden text-ellipsis">
                                  <LocalizedClientLink
                                    href={`/products/${item.product_handle}`}
                                    data-testid="product-link"
                                  >
                                    {item.title}
                                  </LocalizedClientLink>
                                </h3>
                                <LineItemOptions
                                  variant={item.variant}
                                  data-testid="cart-item-variant"
                                  data-value={item.variant}
                                />
                              </div>
                              <CartItemDeleteButton
                                id={item.id}
                                className="shrink-0"
                              />
                            </div>
                            <div className="flex justify-end">
                              <LineItemPrice
                                item={item}
                                style="tight"
                                currencyCode={cartState.currency_code}
                              />
                            </div>
                          </div>
                        </div>
                        <AddToCartStepper
                          variantId={item.variant_id}
                          countryCode={countryCode}
                          initialQuantity={item.quantity}
                          initialLineItemId={item.id}
                          className="w-full"
                        />
                      </div>
                    ))}
                </div>
              ) : (
                <div className="flex-1" data-testid="cart-empty-state" />
              )}

              <div className="p-4 flex flex-col gap-y-4 text-big-regular border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-ui-fg-base font-bold">
                    Subtotal:
                  </span>
                  <span
                    className="text-large-semi"
                    data-testid="cart-subtotal"
                    data-value={subtotal}
                  >
                    {convertToLocale({
                      amount: subtotal,
                      currency_code: currencyCode,
                      maximumFractionDigits: 0,
                      minimumFractionDigits: 0,
                    })}
                  </span>
                </div>

                {amountMissingForMinimum > 0 && (
                  <div
                    className="flex items-start gap-x-2 rounded-md bg-amber-50 p-3 text-amber-900"
                    data-testid="minimum-order-warning"
                  >
                    <ExclamationCircle className="mt-0.5 shrink-0 text-amber-500" />
                    <p className="text-s">
                      Te faltan{" "}
                      <span className="font-bold">
                        {convertToLocale({
                          amount: amountMissingForMinimum,
                          currency_code: currencyCode,
                          maximumFractionDigits: 0,
                          minimumFractionDigits: 0,
                        })}
                      </span>{" "}
                      para el monto mínimo de{" "}
                      <span className="font-bold">
                        {convertToLocale({
                          amount: 20000,
                          currency_code: currencyCode,
                          maximumFractionDigits: 0,
                          minimumFractionDigits: 0,
                        })}
                      </span>
                      .
                    </p>
                  </div>
                )}

                <LocalizedClientLink href="/cart" passHref>
                  <Button
                    className="w-full bg-blue-900"
                    size="large"
                    data-testid="go-to-cart-button"
                  >
                    Ir al carrito
                  </Button>
                </LocalizedClientLink>

                {/* Placeholder estático hasta conectar el cupo real del
                colaborador (customer.employee.spending_limit, ver
                lib/util/check-spending-limit.ts) */}
                <p className="text-center text-xs text-ui-fg-subtle">
                  Recuerda que llevas disponible{" "}
                  <span className="font-semibold">$50.000</span> en tu línea
                  de crédito.
                </p>
                <br />
              </div>
            </div>
          </PopoverPanel>
        </Transition>
      </Popover>
    </div>
  )
}

export default CartDropdown
