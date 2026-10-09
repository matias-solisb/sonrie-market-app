"use client"

import LineItemPrice from "@/modules/common/components/line-item-price"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Thumbnail from "@/modules/products/components/thumbnail"
import { HttpTypes } from "@medusajs/types"
import { clx, Container } from "@medusajs/ui"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  showBorders?: boolean
  currencyCode: string
  /** "large": foto y letra más grandes, precio siempre visible (checkout). */
  size?: "default" | "large"
}

const ItemPreview = ({
  item,
  showBorders = true,
  currencyCode,
  size = "default",
}: ItemProps) => {
  const { handle } = item.variant?.product ?? {}

  if (size === "large") {
    return (
      <div className="flex w-full items-center gap-x-4 py-3">
        <LocalizedClientLink
          href={`/products/${handle}`}
          className="shrink-0"
          tabIndex={-1}
          aria-hidden="true"
        >
          <Thumbnail
            thumbnail={item.thumbnail}
            size="square"
            className="h-14 w-14 rounded-xl bg-neutral-100"
          />
        </LocalizedClientLink>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-semibold text-neutral-900">
            {item.product?.title}
          </span>
          {item.variant?.title && (
            <span className="truncate text-sm text-neutral-600">
              {item.variant.title}
            </span>
          )}
          <span className="mt-1 w-fit rounded-full bg-neutral-100 px-2 py-0.5 text-sm font-medium text-neutral-700">
            {item.quantity} {Number(item.quantity) === 1 ? "unidad" : "unidades"}
          </span>
        </div>
        <LineItemPrice
          className="shrink-0 text-base font-semibold text-neutral-900"
          item={item}
          style="tight"
          currencyCode={currencyCode}
        />
      </div>
    )
  }

  const maxQuantity = item.variant?.inventory_quantity ?? 100

  return (
    <Container
      className={clx(
        "flex gap-4 w-full h-full items-center justify-between p-0",
        {
          "shadow-none": !showBorders,
        }
      )}
    >
      <div className="flex gap-x-4 items-start">
        <LocalizedClientLink href={`/products/${handle}`}>
          <Thumbnail
            thumbnail={item.thumbnail}
            size="square"
            className="bg-neutral-100 rounded-lg w-10 h-10"
          />
        </LocalizedClientLink>
        <div className="flex flex-col gap-y-2 justify-between min-h-full self-stretch">
          <div className="flex flex-col">
            <span className="txt-medium-plus text-neutral-950">
              {item.product?.title}
            </span>
            <span className="text-neutral-600 text-xs">
              {item.variant?.title}
            </span>
          </div>
          <div className="flex small:flex-row flex-col gap-2">
            {(item.metadata?.note as string) && (
              <div className="flex gap-x-1">
                <span className="text-neutral-950 text-xs">Note:</span>
                <span className="text-xs text-neutral-600 italic truncate max-w-44 pr-px">
                  {item.metadata?.note as string}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col-reverse items-end justify-between">
        <LineItemPrice
          className="hidden small:flex"
          item={item}
          style="tight"
          currencyCode={currencyCode}
        />
        <span className="self-end text-xs text-neutral-600 italic">
          {item.quantity}x
        </span>
      </div>
    </Container>
  )
}

export default ItemPreview
