import { useCart } from "@/lib/context/cart-context"
import { getCartApprovalStatus } from "@/lib/util/get-cart-approval-status"
import ItemFull from "@/modules/cart/components/item-full"
import { B2BCart } from "@/types/global"
import { StoreCartLineItem } from "@medusajs/types"
import { useMemo } from "react"

type ItemsTemplateProps = {
  cart: B2BCart
  showBorders?: boolean
  showTotal?: boolean
}

const ItemsTemplate = ({
  cart,
  showBorders = true,
  showTotal = true,
}: ItemsTemplateProps) => {
  const items = cart?.items
  const totalQuantity = useMemo(
    () => cart?.items?.reduce((acc, item) => acc + item.quantity, 0),
    [cart?.items]
  )

  const { isPendingAdminApproval, isPendingSalesManagerApproval } =
    getCartApprovalStatus(cart)

  const isPendingApproval =
    isPendingAdminApproval || isPendingSalesManagerApproval

  const { handleEmptyCart } = useCart()

  const handleRemoveAll = () => {
    if (window.confirm("¿Eliminar todos los productos del carrito?")) {
      handleEmptyCart()
    }
  }

  return (
    <div
      className="w-full bg-white border border-gray-200 rounded-xl p-5"
      data-testid="cart-items-container"
    >
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-neutral-950">
          Mi carrito
        </h2>
        <div className="flex items-center gap-x-4">
          <span className="text-sm text-neutral-950">
            {totalQuantity} Productos
          </span>
          <button
            type="button"
            onClick={handleRemoveAll}
            className="text-sm font-medium text-orange-500 border border-orange-300 rounded-md px-3 py-1.5 hover:bg-orange-50"
            data-testid="empty-cart-button"
          >
            Eliminar todos
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-y-3 w-full">
        {items &&
          items.map((item: StoreCartLineItem) => {
            return (
              <ItemFull
                disabled={isPendingApproval}
                currencyCode={cart?.currency_code}
                showBorders={showBorders}
                key={item.id}
                item={
                  item as StoreCartLineItem & {
                    metadata?: { note?: string }
                  }
                }
              />
            )
          })}
      </div>
    </div>
  )
}

export default ItemsTemplate
