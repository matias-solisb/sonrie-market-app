"use client"

import repeat from "@/lib/util/repeat"
import { HttpTypes } from "@medusajs/types"
import { BaseCartLineItem } from "@medusajs/types/dist/http/cart/common"
import { clx } from "@medusajs/ui"
import ItemPreview from "@/modules/cart/components/item-preview"
import SkeletonLineItem from "@/modules/skeletons/components/skeleton-line-item"

type ItemsTemplateProps = {
  items?: HttpTypes.StoreCartLineItem[] | HttpTypes.StoreOrderLineItem[]
  currencyCode: string
  /** "large": versión del checkout de retiro (ver ItemPreview). */
  size?: "default" | "large"
}

const ItemsPreviewTemplate = ({
  items,
  currencyCode,
  size = "default",
}: ItemsTemplateProps) => {
  const hasOverflow = items && items.length > 4

  return (
    <div
      className={clx({
        "pl-[1px] overflow-y-scroll overflow-x-hidden no-scrollbar max-h-[420px]":
          hasOverflow && size === "default",
        // En el checkout la barra de scroll queda visible: así se nota que
        // hay más productos abajo.
        "overflow-y-auto overflow-x-hidden max-h-[360px] pr-2":
          hasOverflow && size === "large",
      })}
    >
      <div
        className={clx(
          "flex flex-col",
          size === "large" ? "divide-y divide-neutral-100" : "gap-y-2"
        )}
      >
        {items
          ? items
              .sort((a, b) => {
                return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
              })
              .map((item) => {
                return (
                  <ItemPreview
                    key={item.id}
                    currencyCode={currencyCode}
                    item={
                      item as BaseCartLineItem & {
                        metadata?: { note?: string }
                      }
                    }
                    showBorders={false}
                    size={size}
                  />
                )
              })
          : repeat(5).map((i) => {
              return <SkeletonLineItem key={i} />
            })}
      </div>
    </div>
  )
}

export default ItemsPreviewTemplate
