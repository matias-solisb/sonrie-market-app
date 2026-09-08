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
import { useCallback, useState } from "react"

/*

Barra de filtros compartida entre "Mis pedidos" y "Mis documentos" (Buscar
Documentos / Fecha desde / Fecha hasta / Filtrar por, igual a las
capturas). Los filtros viven en la query-string de la URL (mismo patrón
que `modules/store/components/refinement-list`), así que la página
servidor que hace el fetch (orders/page.tsx, payment-documents/page.tsx)
puede leerlos directo de `searchParams` sin duplicar lógica de estado acá.

Los campos de fecha usan el `DatePicker` de MUI (`@mui/x-date-pickers`),
no el de `@medusajs/ui` ni una caja hecha a mano: el sitio legacy
(sonrie.youorder.me) que se está calcando está construido con Material UI
(confirmado inspeccionando sus chunks JS — aparecen clases internas reales
de MUI como `MuiPickersLayout`, `MuiPaper`, `MuiSvgIcon`, etc.; no hay
forma de leer su código fuente porque solo tenemos el sitio como
servicio, pero esas clases solo existen si el paquete real está
bundleado). El popover con "septiembre 2026", las flechas, la fila L M M
J V S D y el círculo en el día de hoy son el look POR DEFECTO del
`DateCalendar` de MUI — no hubo que reconstruir nada de eso a mano, es
tal cual sale de la librería. Lo único que se personalizó es el color de
foco/selección (azul de marca en vez del morado por defecto de MUI) y el
radio de borde, en `src/lib/mui/theme.ts`.

Es la única parte del sitio que usa Material UI — ver el comentario en
`src/lib/mui/date-picker-provider.tsx` sobre por qué no vive en el layout
raíz.

"Filtrar por" abre/cierra un panel con fondo gris debajo de la barra
(`filtersOpen`), con el filtro "Estado" — igual que en el sitio legacy.
Ese "Estado" usa un `Select` real de MUI (mismo criterio que el
`DatePicker`: se calca el componente real, no una imitación) con las
opciones tal cual las muestra el legacy (ver `ORDER_STATUS_OPTIONS` más
abajo).

Ese segundo filtro cambia según la ruta (mismo componente para las dos
páginas, se detecta con el `usePathname()` de más abajo, sin agregar
props ni tocar los `page.tsx`):
- `/account/orders` → "Estado", con el vocabulario de estados SAP del
  sitio legacy.
- `/account/payment-documents` → "Tipo de documento", con los tipos de
  documento que muestra el legacy (Documento de facturación, Documento,
  Nota de débito, Factura, Nota de crédito).

En ambos casos queda como filtro solo visual por ahora (no toca la
query-string ni el fetch de la página): "Estado" no tiene equivalente en
`order.status`/`order.fulfillment_status` de Medusa (ver
`src/lib/util/order-status-labels.ts`), y "Tipo de documento" no tiene
ningún dato detrás porque `dte-storage` (el módulo de boletas/documentos,
ver mapa técnico) todavía no está construido — mismo motivo por el que
`PaymentDocumentsTable` recibe un arreglo vacío. El día que exista el
campo real de cada lado, cada uno se conecta con `setParam` igual que
"Fecha desde"/"Fecha hasta".

*/

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

const parseParam = (value: string): Dayjs | null =>
  value ? dayjs(value, "YYYY-MM-DD") : null

const DocumentFilters = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get("q") ?? "")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [secondFilterValue, setSecondFilterValue] = useState(SECOND_FILTER_PLACEHOLDER)

  const fromParam = searchParams.get("from") ?? ""
  const toParam = searchParams.get("to") ?? ""

  // El segundo filtro del panel gris cambia según la página — ver el
  // comentario grande de arriba del archivo.
  const isPaymentDocuments = pathname.includes("/payment-documents")
  const secondFilterLabel = isPaymentDocuments ? "Tipo de documento" : "Estado"
  const secondFilterPlaceholderLabel = isPaymentDocuments ? "-" : "Seleccione una opción"
  const secondFilterOptions = isPaymentDocuments
    ? DOCUMENT_TYPE_OPTIONS
    : ORDER_STATUS_OPTIONS

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
        <div className="relative flex-1 min-w-[220px]">
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

        <MuiDatePickerProvider>
          <div className="flex items-center gap-3">
            <DatePicker
              label="Fecha desde"
              format="DD/MM/YYYY"
              value={parseParam(fromParam)}
              onChange={(date) =>
                setParam("from", date && date.isValid() ? date.format("YYYY-MM-DD") : null)
              }
              maxDate={parseParam(toParam) ?? undefined}
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    width: { xs: "100%", sm: 176 },
                    "& .MuiOutlinedInput-root": { height: FIELD_HEIGHT },
                  },
                },
              }}
            />
            <DatePicker
              label="Fecha hasta"
              format="DD/MM/YYYY"
              value={parseParam(toParam)}
              onChange={(date) =>
                setParam("to", date && date.isValid() ? date.format("YYYY-MM-DD") : null)
              }
              minDate={parseParam(fromParam) ?? undefined}
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    width: { xs: "100%", sm: 176 },
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
          className="flex items-center gap-x-2 whitespace-nowrap text-sm font-semibold text-blue-900 hover:underline underline-offset-2 small:ml-2"
        >
          Filtrar por
          <BarsArrowDown />
        </button>
      </div>

      {/*
        Panel de filtros adicionales — fondo gris de borde a borde, como en
        la referencia. El campo que muestra ("Estado" o "Tipo de
        documento") cambia según la página — ver comentario grande arriba
        del componente sobre por qué ese selector no filtra nada todavía.
      */}
      {filtersOpen && (
        <div className="w-full bg-neutral-100 px-6 py-4 mt-3">
          <ThemeProvider theme={muiTheme}>
            <FormControl size="small" sx={{ width: { xs: "100%", sm: 408 } }}>
              <InputLabel id="second-filter-label">{secondFilterLabel}</InputLabel>
              <Select
                labelId="second-filter-label"
                label={secondFilterLabel}
                value={secondFilterValue}
                onChange={(e: SelectChangeEvent) => setSecondFilterValue(e.target.value)}
                sx={{ height: 44, backgroundColor: "#fff" }}
              >
                <MenuItem value={SECOND_FILTER_PLACEHOLDER} sx={{ fontWeight: 600 }}>
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
        </div>
      )}
    </div>
  )
}

export default DocumentFilters
