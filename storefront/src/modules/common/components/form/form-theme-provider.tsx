"use client"

import { ThemeProvider } from "@mui/material/styles"
import type { ReactNode } from "react"

import { formTheme } from "@/lib/mui/form-theme"

/*

Cada campo `Form*` se envuelve solo con este provider, así nadie tiene que
acordarse de ponerlo alrededor del formulario. Anidar ThemeProvider es
barato (es un contexto de React) y también cubre los menús de los selects,
que MUI renderiza en un portal.

*/
const FormThemeProvider = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={formTheme}>{children}</ThemeProvider>
)

export default FormThemeProvider
