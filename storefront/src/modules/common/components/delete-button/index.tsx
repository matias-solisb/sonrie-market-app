import { useCart } from "@/lib/context/cart-context"
import { Trash } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import Spinner from "@/modules/common/icons/spinner"
import { useState } from "react"

const DeleteButton = ({
  id,
  className,
  disabled,
}: {
  id: string
  className?: string
  disabled?: boolean
}) => {
  const [isDeleting, setIsDeleting] = useState(false)

  const { handleDeleteItem } = useCart()

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    await handleDeleteItem(id)
  }

  return (
    <button
      type="button"
      className={clx(
        "flex items-center justify-center text-orange-500 hover:text-orange-600 cursor-pointer",
        disabled ? "opacity-50 pointer-events-none" : "opacity-100",
        className
      )}
      onClick={() => handleDelete(id)}
      disabled={disabled}
      aria-label="Eliminar producto"
      data-testid="cart-item-remove-button"
    >
      {isDeleting ? <Spinner size={16} /> : <Trash />}
    </button>
  )
}

export default DeleteButton
