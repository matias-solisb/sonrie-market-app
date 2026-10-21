"use client"

import TextField from "@mui/material/TextField"
import type { ChangeEvent } from "react"
import { useController, type FieldValues } from "react-hook-form"

import { formatRutInput } from "@/lib/util/rut"

import type { FormTextFieldProps } from "./form-text-field"
import FormThemeProvider from "./form-theme-provider"

/*

`FormTextField` para RUT: agrega puntos y guion mientras se escribe
(12.345.678-5) con `rut.js`. El valor del form queda formateado; el schema
zod (`requiredRut`) y el backend (`normalizeRut`) aceptan puntos y guion,
así que no hace falta limpiarlo antes de enviar.

El formateo asume que el último carácter es el DV, por eso mientras se
escribe se ve 1.234-5 antes de llegar a 12.345.678-5.

*/
export function FormRutField<TValues extends FieldValues>({
  name,
  control,
  helperText,
  slotProps,
  ...props
}: Omit<FormTextFieldProps<TValues>, "type">) {
  const {
    field: { ref, value, onChange, ...field },
    fieldState: { error },
  } = useController({ name, control })

  return (
    <FormThemeProvider>
      <TextField
        fullWidth
        {...props}
        {...field}
        value={value ?? ""}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(formatRutInput(e.target.value))
        }
        inputRef={ref}
        error={Boolean(error)}
        helperText={error?.message ?? helperText}
        slotProps={{
          ...slotProps,
          htmlInput: {
            // "text" y no "numeric": el DV puede ser K.
            inputMode: "text",
            autoCapitalize: "characters",
            maxLength: 12, // 12.345.678-5
            ...(slotProps?.htmlInput as object | undefined),
          },
        }}
      />
    </FormThemeProvider>
  )
}

export default FormRutField
