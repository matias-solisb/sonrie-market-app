"use client"

import { clx } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import ReactCountryFlag from "react-country-flag"

import ChevronDown from "@/modules/common/icons/chevron-down"
import {
  COUNTRY_CALLING_CODES,
  type CountryCallingCode,
} from "@/lib/data/country-calling-codes"

const DEFAULT_COUNTRY = "CL"

// Separa un teléfono guardado (p.ej. "+56912345678") en país + número
// local, buscando el `dialCode` más largo que calce (para no confundir,
// p.ej., +1 de Canadá con +1264 de Anguilla). Si no hay "+" o no calza
// ninguno, se asume Chile y el valor completo (solo dígitos) es el número
// local — así los teléfonos guardados antes de este cambio (sin código de
// país) se siguen viendo bien.
export const parsePhoneNumber = (raw?: string | null) => {
  const digits = (raw || "").replace(/\D/g, "")

  if (raw?.trim().startsWith("+")) {
    const match = [...COUNTRY_CALLING_CODES]
      .sort((a, b) => b.dialCode.length - a.dialCode.length)
      .find((c) => digits.startsWith(c.dialCode))

    if (match) {
      return { countryCode: match.code, localNumber: digits.slice(match.dialCode.length) }
    }
  }

  return { countryCode: DEFAULT_COUNTRY, localNumber: digits }
}

export const getDialCode = (countryCode: string) =>
  COUNTRY_CALLING_CODES.find((c) => c.code === countryCode)?.dialCode ?? ""

const PhoneCountrySelect = ({
  value,
  onChange,
}: {
  value: string
  onChange: (countryCode: string) => void
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const current: CountryCallingCode | undefined = COUNTRY_CALLING_CODES.find(
    (c) => c.code === value
  )

  // El panel se renderiza en un portal a `document.body`, posicionado con
  // `fixed` a partir del botón: la card (`ProfileCard`) tiene varios
  // ancestros con `overflow-hidden` (usados para la animación de
  // colapso), así que una lista absolutamente posicionada adentro se
  // recortaría antes de llegar a mostrar las ~240 filas.
  useEffect(() => {
    if (!open) {
      return
    }

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (rect) {
        setPosition({ top: rect.bottom + 6, left: rect.left })
      }
    }

    updatePosition()

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      ) {
        return
      }
      setOpen(false)
    }

    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  const filtered = COUNTRY_CALLING_CODES.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex shrink-0 items-center gap-x-1.5 text-base text-neutral-950"
      >
        {current && (
          <ReactCountryFlag
            countryCode={current.code}
            svg
            style={{ width: "20px", height: "20px", borderRadius: "9999px" }}
            aria-label={current.name}
          />
        )}
        +{current?.dialCode}
        <ChevronDown
          size="14"
          className={clx("text-neutral-400 transition-transform", {
            "rotate-180": open,
          })}
        />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: position.top, left: position.left }}
            className="z-[1000] flex w-72 max-h-80 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg"
          >
            <div className="shrink-0 border-b border-neutral-100 p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar país"
                className="w-full rounded-md border border-neutral-200 px-3 py-1.5 text-sm outline-none"
              />
            </div>
            <ul className="overflow-y-auto py-1">
              {filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.code)
                      setOpen(false)
                      setQuery("")
                    }}
                    className={clx(
                      "flex w-full items-center justify-between gap-x-3 px-4 py-2.5 text-left text-sm hover:bg-neutral-100",
                      { "bg-neutral-100 font-medium": c.code === value }
                    )}
                  >
                    <span className="flex items-center gap-x-2">
                      <ReactCountryFlag
                        countryCode={c.code}
                        svg
                        style={{ width: "18px", height: "18px", borderRadius: "9999px" }}
                        aria-label={c.name}
                      />
                      {c.name}
                    </span>
                    <span className="text-neutral-500">+{c.dialCode}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-4 py-3 text-sm text-neutral-500">Sin resultados</li>
              )}
            </ul>
          </div>,
          document.body
        )}
    </>
  )
}

export default PhoneCountrySelect
