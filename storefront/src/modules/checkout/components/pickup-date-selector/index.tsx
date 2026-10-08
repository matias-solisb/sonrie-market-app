"use client"

import { setCartPickupDate } from "@/lib/data/cart"
import { PickupSlots } from "@/lib/data/pickup-slots"
import { formatPickupDate, pickupDateParts } from "@/lib/util/pickup-date"
import ErrorMessage from "@/modules/checkout/components/error-message"
import { clx, Text } from "@medusajs/ui"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/*

Selector de la fecha de retiro (pickup-scheduling), dentro de "Retiro en
sala" del checkout.

- Muestra las fechas que devuelve GET /store/pickup-slots: de mañana a 14
  días (configurable por site). Los días cerrados o llenos aparecen
  deshabilitados, con el motivo si lo hay.
- Al elegir un día lo guarda de inmediato (setCartPickupDate →
  metadata.pickup_date) y refresca la página. No reserva el cupo: eso
  ocurre al confirmar el pedido; si alguien toma el último cupo entre
  medio, el checkout responde con el error del backend.
- Con 5 cupos o menos avisa "Últimos cupos" (no muestra el número).
- Mientras se guarda muestra "Guardando la fecha…"; "Retiras el …" aparece
  recién cuando el backend la guardó (si se recarga antes, la fecha no
  quedaría guardada).

Botones con aria-pressed (no radios): cada botón es una acción que guarda
la fecha, y así se navega con Tab como el resto del checkout.

*/
const FEW_SLOTS = 5

type Props = {
  slots: PickupSlots | null
  selected: string | null
  siteName: string
}

const PickupDateSelector = ({ slots, selected, siteName }: Props) => {
  const router = useRouter()
  const [chosen, setChosen] = useState<string | null>(selected)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!slots) {
    return (
      <Text className="text-ui-fg-subtle" data-testid="pickup-dates-error">
        No pudimos cargar las fechas de retiro. Recarga la página para intentar de nuevo.
      </Text>
    )
  }

  const fechas = slots.fechas
  const hasAvailable = fechas.some((f) => f.disponible)
  const chosenSlot = fechas.find((f) => f.fecha === chosen)
  const chosenIsValid = !!chosenSlot?.disponible

  const choose = (fecha: string) => {
    if (isPending || fecha === chosen) return

    const previous = chosen
    setChosen(fecha)
    setError(null)

    startTransition(async () => {
      const result = await setCartPickupDate(fecha)

      if ("error" in result && result.error) {
        setChosen(previous)
        setError(result.error)
        return
      }

      router.refresh()
    })
  }

  if (!hasAvailable) {
    return (
      <Text className="text-ui-fg-subtle" data-testid="pickup-dates-empty">
        No hay fechas de retiro disponibles en {siteName} por ahora. Intenta más
        tarde.
      </Text>
    )
  }

  return (
    <div className="flex flex-col gap-y-3" data-testid="pickup-date-selector">
      <div>
        <Text weight="plus" id="pickup-date-label">
          Fecha de retiro
        </Text>
        {isPending ? (
          <Text className="text-ui-fg-subtle" data-testid="pickup-date-saving">
            Guardando la fecha…
          </Text>
        ) : chosen && chosenIsValid ? (
          <Text className="text-ui-fg-subtle" data-testid="pickup-date-selected">
            Retiras el {formatPickupDate(chosen)}.
          </Text>
        ) : chosen && !chosenIsValid ? (
          <Text className="text-rose-500" data-testid="pickup-date-invalid">
            La fecha que elegiste ya no tiene cupo. Elige otra.
          </Text>
        ) : (
          <Text className="text-ui-fg-subtle">
            Elige el día en que vas a retirar tu pedido.
          </Text>
        )}
      </div>

      <div
        role="group"
        aria-labelledby="pickup-date-label"
        className="grid grid-cols-3 gap-2 xsmall:grid-cols-4 small:grid-cols-7"
      >
        {fechas.map((slot) => {
          const { weekday, day, month } = pickupDateParts(slot.fecha)
          const isChosen = slot.fecha === chosen
          const disabled = !slot.disponible || isPending
          const note = !slot.disponible
            ? slot.motivo ?? (slot.cupos === 0 ? "Sin cupos" : "Cerrado")
            : slot.cupos <= FEW_SLOTS
              ? "Últimos cupos"
              : null

          return (
            <button
              key={slot.fecha}
              type="button"
              onClick={() => choose(slot.fecha)}
              disabled={disabled}
              aria-pressed={isChosen}
              aria-label={`${formatPickupDate(slot.fecha)}${note ? `, ${note}` : ""}`}
              title={note ?? undefined}
              data-testid="pickup-date-option"
              data-fecha={slot.fecha}
              data-disponible={slot.disponible}
              className={clx(
                "flex min-h-[76px] flex-col items-center justify-center rounded-lg border px-1 py-2 text-center transition-colors",
                isChosen && slot.disponible
                  ? "border-blue-900 bg-blue-50 text-blue-900"
                  : slot.disponible
                    ? "border-neutral-200 bg-white text-neutral-900 hover:border-blue-900"
                    : "cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-400",
                isPending && slot.disponible && "cursor-wait"
              )}
            >
              <span className="text-xs">{weekday}</span>
              <span className="text-lg font-bold leading-tight">{day}</span>
              <span className="text-xs">{month}</span>
              {note && (
                <span
                  className={clx(
                    "mt-0.5 w-full truncate text-[10px] leading-tight",
                    slot.disponible ? "text-amber-700" : "text-neutral-400"
                  )}
                >
                  {note}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <ErrorMessage error={error} data-testid="pickup-date-error" />
    </div>
  )
}

export default PickupDateSelector
