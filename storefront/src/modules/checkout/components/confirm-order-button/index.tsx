"use client"

import { confirmOrder } from "@/lib/data/cart"
import ErrorMessage from "@/modules/checkout/components/error-message"
import { clx } from "@medusajs/ui"
import { useRef, useState, useTransition } from "react"

/*

Botón "Confirmar pedido" del checkout. Llama a la server action
`confirmOrder` (crea la sesión "Cargo beneficio" y completa el carrito);
si sale bien, la action redirige a la confirmación del pedido.

Doble clic: `submitting` se marca antes del primer await y el botón queda
deshabilitado hasta que la action termina; un segundo clic no hace nada.
Igual el backend es idempotente por carrito.

*/
const ConfirmOrderButton = ({
  disabled,
  disabledReason,
}: {
  disabled?: boolean
  disabledReason?: string
}) => {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const submitting = useRef(false)

  const onClick = () => {
    if (disabled || submitting.current) return

    submitting.current = true
    setError(null)

    startTransition(async () => {
      const result = await confirmOrder()

      // Si hubo redirect no llega acá; si llega, el pedido no se creó.
      if (result?.error) {
        setError(result.error)
      }
      submitting.current = false
    })
  }

  const isDisabled = disabled || isPending

  return (
    <div className="flex flex-col gap-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        aria-busy={isPending}
        data-testid="submit-order-button"
        className={clx(
          "w-full h-11 rounded-xl text-sm font-bold transition-colors",
          isDisabled
            ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            : "bg-blue-900 text-white hover:bg-blue-800"
        )}
      >
        {isPending ? "Confirmando..." : "Confirmar pedido"}
      </button>
      {disabled && disabledReason && (
        <p className="text-xs text-ui-fg-subtle" data-testid="submit-disabled-reason">
          {disabledReason}
        </p>
      )}
      <ErrorMessage error={error} data-testid="submit-order-error" />
    </div>
  )
}

export default ConfirmOrderButton
