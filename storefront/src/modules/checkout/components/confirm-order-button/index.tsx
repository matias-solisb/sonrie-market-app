"use client"

import { confirmOrder } from "@/lib/data/cart"
import ErrorMessage from "@/modules/checkout/components/error-message"
import { CheckCircleSolid, ExclamationCircleSolid, Spinner } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import { useRef, useState, useTransition } from "react"

/*

Botón "Confirmar pedido" del checkout. Llama a la server action
`confirmOrder` (crea la sesión "Cargo beneficio" y completa el carrito);
si sale bien, la action redirige a la confirmación del pedido.

Doble clic: `submitting` se marca antes del primer await y el botón queda
deshabilitado hasta que la action termina; un segundo clic no hace nada.
Igual el backend es idempotente por carrito.

Botón alto (56px) y letra grande para que sea fácil de tocar; si está
bloqueado, el motivo se muestra en un aviso con ícono.

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
    <div className="flex flex-col gap-y-3">
      {disabled && disabledReason && (
        <div className="flex items-start gap-x-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <ExclamationCircleSolid className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-base" data-testid="submit-disabled-reason">
            {disabledReason}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        aria-busy={isPending}
        data-testid="submit-order-button"
        className={clx(
          "flex h-14 w-full items-center justify-center gap-x-2 rounded-2xl text-lg font-bold transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2",
          isPending
            ? "cursor-wait bg-blue-800 text-white"
            : disabled
              ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
              : "bg-blue-900 text-white shadow-[0_8px_20px_rgba(30,58,138,0.25)] hover:bg-blue-800 active:scale-[0.99]"
        )}
      >
        {isPending ? (
          <Spinner className="animate-spin" aria-hidden="true" />
        ) : (
          <CheckCircleSolid aria-hidden="true" />
        )}
        {isPending ? "Confirmando..." : "Confirmar pedido"}
      </button>
      <ErrorMessage error={error} variant="box" data-testid="submit-order-error" />
    </div>
  )
}

export default ConfirmOrderButton
