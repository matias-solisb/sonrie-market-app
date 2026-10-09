"use client"

import { setCartPickupDate } from "@/lib/data/cart"
import { PickupSlots } from "@/lib/data/pickup-slots"
import { formatPickupDate, pickupDateParts } from "@/lib/util/pickup-date"
import ErrorMessage from "@/modules/checkout/components/error-message"
import {
  CalendarSolid,
  CheckCircleSolid,
  CheckMini,
  ExclamationCircleSolid,
  Spinner,
} from "@medusajs/icons"
import { clx } from "@medusajs/ui"
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
- Si la fecha guardada ya no sirve (se llenó, se cerró, o ya pasó porque
  el carrito quedó de un día para otro), lo dice y pide elegir otra; el
  botón "Confirmar pedido" queda deshabilitado hasta entonces.
- Mientras se guarda muestra "Guardando la fecha…"; "Retiras el …" aparece
  recién cuando el backend la guardó (si se recarga antes, la fecha no
  quedaría guardada).

Botones con aria-pressed (no radios): cada botón es una acción que guarda
la fecha, y así se navega con Tab como el resto del checkout.

Diseño: botones grandes (día en número grande) para que sea fácil de leer y
de tocar a cualquier edad; el día elegido queda en azul sólido con un ✓.

*/
const FEW_SLOTS = 5

type Props = {
  slots: PickupSlots | null
  selected: string | null
  siteName: string
}

const Notice = ({
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p
    className="rounded-xl bg-neutral-50 px-4 py-3 text-base text-neutral-700"
    {...props}
  >
    {children}
  </p>
)

/**
 * Por qué la fecha guardada ya no sirve: el día se llenó o se cerró
 * (sigue en la lista, deshabilitado), o ya pasó o quedó fuera del rango
 * (no está en la lista, p. ej. un carrito que se dejó de un día para otro).
 */
const invalidMessage = (
  fecha: string,
  slot: PickupSlots["fechas"][number] | undefined
) => {
  if (!slot) {
    return `El ${formatPickupDate(fecha)} ya no está disponible para retiro. Elige otra fecha.`
  }
  return `El ${formatPickupDate(fecha)} ya no está disponible${
    slot.motivo ? ` (${slot.motivo})` : ""
  }. Elige otra fecha.`
}

const PickupDateSelector = ({ slots, selected, siteName }: Props) => {
  const router = useRouter()
  const [chosen, setChosen] = useState<string | null>(selected)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!slots) {
    return (
      <Notice data-testid="pickup-dates-error">
        No pudimos cargar las fechas de retiro. Recarga la página para intentar de nuevo.
      </Notice>
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
      <Notice data-testid="pickup-dates-empty">
        No hay fechas de retiro disponibles en {siteName} por ahora. Intenta más
        tarde.
      </Notice>
    )
  }

  return (
    <div className="flex flex-col gap-y-4" data-testid="pickup-date-selector">
      <div className="flex flex-col gap-y-1">
        <p
          id="pickup-date-label"
          className="flex items-center gap-x-2 text-base font-semibold text-neutral-900"
        >
          <CalendarSolid className="text-[#E01441]" aria-hidden="true" />
          Fecha de retiro
        </p>
        <div aria-live="polite">
          {isPending ? (
            <p
              className="flex items-center gap-x-2 text-base text-neutral-600"
              data-testid="pickup-date-saving"
            >
              <Spinner className="animate-spin" aria-hidden="true" />
              Guardando la fecha…
            </p>
          ) : chosen && chosenIsValid ? (
            <p
              className="flex items-center gap-x-2 text-base font-medium text-green-700"
              data-testid="pickup-date-selected"
            >
              <CheckCircleSolid aria-hidden="true" />
              Retiras el {formatPickupDate(chosen)}.
            </p>
          ) : chosen && !chosenIsValid ? (
            <p
              className="flex items-center gap-x-2 text-base font-medium text-rose-600"
              data-testid="pickup-date-invalid"
            >
              <ExclamationCircleSolid aria-hidden="true" />
              {invalidMessage(chosen, chosenSlot)}
            </p>
          ) : (
            <p className="text-base text-neutral-600">
              Elige el día en que vas a retirar tu pedido.
            </p>
          )}
        </div>
      </div>

      <div
        role="group"
        aria-labelledby="pickup-date-label"
        className="grid grid-cols-3 gap-2.5 xsmall:grid-cols-4 small:grid-cols-5 medium:grid-cols-7"
      >
        {fechas.map((slot) => {
          const { weekday, day, month } = pickupDateParts(slot.fecha)
          const isChosen = slot.fecha === chosen && slot.disponible
          const disabled = !slot.disponible || isPending
          const fewSlots = slot.disponible && slot.cupos <= FEW_SLOTS
          const note = !slot.disponible
            ? slot.motivo ?? (slot.cupos === 0 ? "Sin cupos" : "Cerrado")
            : fewSlots
              ? "Últimos cupos"
              : null

          return (
            <button
              key={slot.fecha}
              type="button"
              onClick={() => choose(slot.fecha)}
              disabled={disabled}
              aria-pressed={slot.fecha === chosen}
              aria-label={`${formatPickupDate(slot.fecha)}${note ? `, ${note}` : ""}`}
              title={note ?? undefined}
              data-testid="pickup-date-option"
              data-fecha={slot.fecha}
              data-disponible={slot.disponible}
              className={clx(
                "relative flex min-h-[96px] flex-col items-center justify-center gap-y-0.5 rounded-xl border-2 px-1 py-2 text-center transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2",
                isChosen
                  ? "border-blue-900 bg-blue-900 text-white shadow-[0_6px_16px_rgba(30,58,138,0.25)]"
                  : slot.disponible
                    ? "border-neutral-200 bg-white text-neutral-900 hover:-translate-y-0.5 hover:border-blue-900 hover:bg-blue-50 motion-reduce:hover:translate-y-0"
                    : "cursor-not-allowed border-dashed border-neutral-200 bg-neutral-50 text-neutral-400",
                isPending && slot.disponible && "cursor-wait"
              )}
            >
              {isChosen && (
                <span
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-blue-900"
                  aria-hidden="true"
                >
                  <CheckMini />
                </span>
              )}
              <span className="text-sm font-medium">{weekday}</span>
              <span className="text-2xl font-bold leading-none">{day}</span>
              <span className="text-sm">{month}</span>
              {note && (
                <span
                  className={clx(
                    "mt-1 max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold leading-tight",
                    isChosen
                      ? "bg-white/20 text-white"
                      : slot.disponible
                        ? "bg-amber-100 text-amber-800"
                        : "text-neutral-500"
                  )}
                >
                  {note}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <ErrorMessage error={error} variant="box" data-testid="pickup-date-error" />
    </div>
  )
}

export default PickupDateSelector
