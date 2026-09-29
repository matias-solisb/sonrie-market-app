"use client"

import { MuiDatePickerProvider } from "@/lib/mui/date-picker-provider"
import { muiTheme } from "@/lib/mui/theme"
import { BarsArrowDown, MagnifyingGlass } from "@medusajs/icons"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import MenuItem from "@mui/material/MenuItem"
import Select, { SelectChangeEvent } from "@mui/material/Select"
import { ThemeProvider } from "@mui/material/styles"
import { DatePicker } from "@mui/x-date-pickers/DatePicker"
import dayjs, { Dayjs } from "dayjs"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"


const PAGE_PARAM = "page"

// Caja del buscador — mismo alto que los DatePicker de al lado
// (`FIELD_HEIGHT` más abajo controla la de ellos).
const FIELD_BOX_CLASS =
  "w-full h-11 rounded-md border border-gray-200 bg-white pl-3 pr-9 text-sm text-neutral-950 outline-none hover:border-gray-300 focus:border-gray-400"

// Alto de los campos de fecha de MUI, para que calcen con el buscador de
// al lado (`FIELD_BOX_CLASS` de arriba, h-11 = 44px). MUI por defecto usa
// más alto (56px) — esto se lo pasa vía `sx` al TextField interno.
const FIELD_HEIGHT = 44

// Opciones del filtro "Estado" (`/account/orders`), copiadas tal cual del
// sitio legacy — ver el comentario grande de arriba sobre por qué este
// selector no está conectado a ningún filtro real todavía.
const ORDER_STATUS_OPTIONS = [
  "pendiente aprobación de administrador",
  "Llegando a destino",
  "cancelado",
  "entregado",
  "parcialmente entregado",
  "ingresado",
  "pendiente aprobación",
  "por recoger",
  "procesado",
  "rechazado",
  "despachado",
  "pendiente pago",
]

// Opciones del filtro "Tipo de documento" (`/account/payment-documents`),
// también copiadas tal cual del sitio legacy.
const DOCUMENT_TYPE_OPTIONS = [
  "Documento de facturación",
  "Documento",
  "Nota de débito",
  "Factura",
  "Nota de crédito",
]

// Valor "sentinel" para la opción de encabezado (primera fila de la
// lista, resaltada). No se usa "" porque con un value vacío el label de
// MUI ("Estado"/"Tipo de documento") no queda fijo en el borde (notch) —
// se ve flotando adentro de la caja como placeholder — y en la
// referencia siempre aparece arriba, pegado al borde, esté lo que esté
// seleccionado. El TEXTO de esa opción sí cambia por ruta (ver
// `secondFilterPlaceholder` más abajo): "Seleccione una opción" en
// pedidos, "-" en documentos — así se ve en el sitio legacy en cada caso.
const SECOND_FILTER_PLACEHOLDER = "__placeholder__"
const MOBILE_MEDIA = "@media (max-width: 600px)"

const parseParam = (value: string): Dayjs | null =>
  value ? dayjs(value, "YYYY-MM-DD") : null

const DocumentFilters = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get("q") ?? "")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [secondFilterValue, setSecondFilterValue] = useState(
    SECOND_FILTER_PLACEHOLDER
  )

  const fromParam = searchParams.get("from") ?? ""
  const toParam = searchParams.get("to") ?? ""

  // El segundo filtro del panel gris cambia según la página — ver el
  // comentario grande de arriba del archivo.
  const isPaymentDocuments = pathname.includes("/payment-documents")
  const secondFilterLabel = isPaymentDocuments ? "Tipo de documento" : "Estado"
  const secondFilterPlaceholderLabel = isPaymentDocuments
    ? "-"
    : "Seleccione una opción"
  const secondFilterOptions = isPaymentDocuments
    ? DOCUMENT_TYPE_OPTIONS
    : ORDER_STATUS_OPTIONS

  // Borrador de fechas (móvil y escritorio) — solo se aplica con
  // "Aplicar filtros". Se re-sincroniza si la URL cambia por otro lado.
  const [draftFrom, setDraftFrom] = useState(fromParam)
  const [draftTo, setDraftTo] = useState(toParam)

  useEffect(() => {
    setDraftFrom(fromParam)
    setDraftTo(toParam)
  }, [fromParam, toParam])

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams)

    if (draftFrom) {
      params.set("from", draftFrom)
    } else {
      params.delete("from")
    }

    if (draftTo) {
      params.set("to", draftTo)
    } else {
      params.delete("to")
    }

    params.delete(PAGE_PARAM)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })

    // En móvil el panel gris tiene las fechas, así que se cierra al
    // aplicar. Sobre 600px queda como estaba (ahí solo tiene "Estado").
    if (window.matchMedia("(max-width: 600px)").matches) {
      setFiltersOpen(false)
    }
  }

  // "Limpiar filtros": vacía fechas y Estado y quita las fechas de la URL
  // (la tabla vuelve a mostrar todo). El panel, si está abierto, queda
  // abierto.
  const clearFilters = () => {
    setDraftFrom("")
    setDraftTo("")
    setSecondFilterValue(SECOND_FILTER_PLACEHOLDER)

    const params = new URLSearchParams(searchParams)
    params.delete("from")
    params.delete("to")
    params.delete(PAGE_PARAM)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const setParam = useCallback(
    (name: string, value: string | null) => {
      const params = new URLSearchParams(searchParams)

      if (value) {
        params.set(name, value)
      } else {
        params.delete(name)
      }

      // Cualquier cambio de filtro reinicia la paginación.
      params.delete(PAGE_PARAM)

      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col small:flex-row small:items-center gap-3 w-full">
        <div className="flex items-center gap-3 flex-1 min-w-[220px]">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar Documentos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setParam("q", search || null)
                }
              }}
              onBlur={() => setParam("q", search || null)}
              className={FIELD_BOX_CLASS}
            />
            <MagnifyingGlass className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-blue-900" />
          </div>

          {/* Solo móvil: icono de filtro sin texto, al lado del buscador. */}
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-label="Filtrar por"
            className="hidden max-[600px]:flex items-center justify-center shrink-0 text-blue-900"
          >
            <BarsArrowDown />
          </button>
        </div>

        <MuiDatePickerProvider>
          <div className="flex items-center gap-3 flex-[2] min-w-0 max-[600px]:hidden">
            <DatePicker
              label="Fecha desde"
              format="DD/MM/YYYY"
              value={parseParam(draftFrom)}
              onChange={(date) =>
                setDraftFrom(
                  date && date.isValid() ? date.format("YYYY-MM-DD") : ""
                )
              }
              maxDate={parseParam(draftTo) ?? undefined}
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    flex: 1,
                    minWidth: 0,
                    "& .MuiOutlinedInput-root": { height: FIELD_HEIGHT },
                  },
                },
              }}
            />
            <DatePicker
              label="Fecha hasta"
              format="DD/MM/YYYY"
              value={parseParam(draftTo)}
              onChange={(date) =>
                setDraftTo(
                  date && date.isValid() ? date.format("YYYY-MM-DD") : ""
                )
              }
              minDate={parseParam(draftFrom) ?? undefined}
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    flex: 1,
                    minWidth: 0,
                    "& .MuiOutlinedInput-root": { height: FIELD_HEIGHT },
                  },
                },
              }}
            />
          </div>
        </MuiDatePickerProvider>

        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          className="flex max-[600px]:hidden items-center gap-x-2 whitespace-nowrap text-sm font-semibold text-blue-900 hover:underline underline-offset-2 small:ml-2"
        >
          Filtrar por
          <BarsArrowDown />
        </button>

        {/* Sobre 600px: "Limpiar filtros" y "Aplicar filtros" en la misma
            fila, a la derecha de "Filtrar por". En móvil van dentro del
            panel gris (más abajo). */}
        <div className="flex max-[600px]:hidden items-center gap-x-6 shrink-0 small:ml-2">
          <button
            type="button"
            onClick={clearFilters}
            className="whitespace-nowrap text-sm font-semibold text-blue-900 hover:underline underline-offset-2"
          >
            Limpiar filtros
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="whitespace-nowrap h-11 px-6 rounded-lg bg-blue-900 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Aplicar filtros
          </button>
        </div>
      </div>

      {/*
        Panel de filtros adicionales — fondo gris de borde a borde, como en
        la referencia. El campo que muestra ("Estado" o "Tipo de
        documento") cambia según la página — ver comentario grande arriba
        del componente sobre por qué ese selector no filtra nada todavía.
      */}
      {filtersOpen && (
        <div className="w-full bg-neutral-100 px-6 py-4 mt-3 flex flex-col gap-4">
          {/* Solo móvil: fechas apiladas, se aplican con "Aplicar filtros". */}
          <div className="hidden max-[600px]:flex flex-col gap-4">
            <MuiDatePickerProvider>
              <DatePicker
                label="Fecha desde"
                format="DD/MM/YYYY"
                value={parseParam(draftFrom)}
                onChange={(date) =>
                  setDraftFrom(
                    date && date.isValid() ? date.format("YYYY-MM-DD") : ""
                  )
                }
                maxDate={parseParam(draftTo) ?? undefined}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: {
                      width: "100%",
                      backgroundColor: "#fff",
                      "& .MuiOutlinedInput-root": { height: FIELD_HEIGHT },
                    },
                  },
                }}
              />
              <DatePicker
                label="Fecha hasta"
                format="DD/MM/YYYY"
                value={parseParam(draftTo)}
                onChange={(date) =>
                  setDraftTo(
                    date && date.isValid() ? date.format("YYYY-MM-DD") : ""
                  )
                }
                minDate={parseParam(draftFrom) ?? undefined}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: {
                      width: "100%",
                      backgroundColor: "#fff",
                      "& .MuiOutlinedInput-root": { height: FIELD_HEIGHT },
                    },
                  },
                }}
              />
            </MuiDatePickerProvider>
          </div>

          <ThemeProvider theme={muiTheme}>
            <FormControl
              size="small"
              sx={{
                width: { xs: "100%", sm: 408 },
                [MOBILE_MEDIA]: { width: "100%" },
              }}
            >
              <InputLabel id="second-filter-label">
                {secondFilterLabel}
              </InputLabel>
              <Select
                labelId="second-filter-label"
                label={secondFilterLabel}
                value={secondFilterValue}
                onChange={(e: SelectChangeEvent) =>
                  setSecondFilterValue(e.target.value)
                }
                sx={{ height: 44, backgroundColor: "#fff" }}
              >
                <MenuItem
                  value={SECOND_FILTER_PLACEHOLDER}
                  sx={{ fontWeight: 600 }}
                >
                  {secondFilterPlaceholderLabel}
                </MenuItem>
                {secondFilterOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </ThemeProvider>

          {/* Solo móvil: "Limpiar filtros" a la izquierda, "Aplicar
              filtros" a la derecha. */}
          <div className="hidden max-[600px]:flex items-center justify-between">
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-blue-900 hover:underline underline-offset-2"
            >
              Limpiar filtros
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className="h-11 px-6 rounded-lg bg-blue-900 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentFilters
