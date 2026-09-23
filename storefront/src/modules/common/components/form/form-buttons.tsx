"use client"

import { clx } from "@medusajs/ui"
import type { ButtonHTMLAttributes, ReactNode } from "react"

type BaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  children: ReactNode
  /** Ocupa todo el ancho (login, recuperar contraseña). */
  fullWidth?: boolean
}

const BASE_CLASS =
  "inline-flex h-11 items-center justify-center rounded-md px-6 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"

/*

Botones de los formularios con el estilo de marca (azul `blue-900`, el
mismo del sitio legacy). `className` se mezcla con `clx` (tailwind-merge),
así que se puede ajustar el tamaño puntual (`className="h-12 text-base"`)
sin duplicar el resto de las clases.

*/
export const FormSubmitButton = ({
  isPending = false,
  pendingLabel,
  fullWidth,
  disabled,
  className,
  children,
  ...props
}: BaseProps & {
  /** Deshabilita el botón y muestra `pendingLabel` mientras se envía. */
  isPending?: boolean
  pendingLabel?: ReactNode
}) => (
  <button
    type="submit"
    disabled={disabled || isPending}
    aria-busy={isPending || undefined}
    className={clx(
      BASE_CLASS,
      "bg-blue-900 text-white hover:bg-blue-800",
      fullWidth && "w-full",
      className
    )}
    {...props}
  >
    {isPending && pendingLabel ? pendingLabel : children}
  </button>
)

/** Botón secundario ("Cancelar"): borde gris, texto azul. Nunca envía. */
export const FormCancelButton = ({
  fullWidth,
  className,
  children,
  ...props
}: BaseProps) => (
  <button
    type="button"
    className={clx(
      BASE_CLASS,
      "border border-neutral-300 bg-white text-blue-900 hover:bg-neutral-50",
      fullWidth && "w-full",
      className
    )}
    {...props}
  >
    {children}
  </button>
)
