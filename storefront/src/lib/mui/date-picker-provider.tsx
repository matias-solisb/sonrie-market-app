"use client"

import { ThemeProvider } from "@mui/material/styles"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import "dayjs/locale/es"
import { ReactNode } from "react"
import { muiTheme } from "./theme"

/*

Envuelve cualquier `DatePicker` de MUI con lo que necesita para verse y
comportarse en español: `LocalizationProvider` (adaptador dayjs +
`adapterLocale="es"`, así el calendario sale con "septiembre 2026",
"L M M J V S D", etc.) y el `ThemeProvider` con `muiTheme` (ver
`./theme.ts`) para que el color de foco/selección sea el azul de marca en
vez del morado por defecto de MUI.

A propósito NO vive en el layout raíz del sitio — se importa solo donde
se usa un `DatePicker` de MUI (hoy: `document-filters`), para que quede
claro que es una isla de Material UI dentro de un sitio que por lo demás
es Tailwind + @medusajs/ui, no una migración de todo el proyecto.

*/
export const MuiDatePickerProvider = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={muiTheme}>
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      {children}
    </LocalizationProvider>
  </ThemeProvider>
)
