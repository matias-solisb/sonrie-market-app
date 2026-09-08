"use client"

import { MuiDatePickerProvider } from "@/lib/mui/date-picker-provider"
import { BarsArrowDown, MagnifyingGlass } from "@medusajs/icons"
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

"Filtrar por" queda como botón de UI por ahora — todavía no hay un set de
filtros adicionales definido (columnas de documentos/boletas dependen del
módulo `dte-storage`, ver mapa técnico), así que no se le agregó
comportamiento propio.

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

const parseParam = (value: string): Dayjs | null =>
  value ? dayjs(value, "YYYY-MM-DD") : null

const DocumentFilters = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get("q") ?? "")

  const fromParam = searchParams.get("from") ?? ""
  const toParam = searchParams.get("to") ?? ""

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
        className="flex items-center gap-x-2 whitespace-nowrap text-sm font-semibold text-blue-900 hover:underline underline-offset-2 small:ml-2"
      >
        Filtrar por
        <BarsArrowDown />
      </button>
    </div>
  )
}

export default DocumentFilters
