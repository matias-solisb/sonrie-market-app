"use client"

import TextField from "@mui/material/TextField"
import type { ReactNode } from "react"

import FormThemeProvider from "./form-theme-provider"

/*

Dato que se muestra con el mismo look que los campos del formulario pero
no se puede editar (p.ej. Email e ID del comercio en "Editar Datos"). No
va conectado a react-hook-form: no tiene valor que validar ni enviar.

*/
export const FormReadOnlyField = ({
  label,
  value,
}: {
  label: ReactNode
  value?: string | null
}) => (
  <FormThemeProvider>
    <TextField label={label} value={value || "—"} disabled fullWidth />
  </FormThemeProvider>
)

export default FormReadOnlyField
