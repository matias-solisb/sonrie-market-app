"use client"

import MenuItem from "@mui/material/MenuItem"
import type { ReactNode } from "react"
import type { FieldValues } from "react-hook-form"

import { FormTextField, type FormTextFieldProps } from "./form-text-field"

export type FormSelectOption = {
  value: string
  label: ReactNode
}

type FormSelectFieldProps<TValues extends FieldValues> = Omit<
  FormTextFieldProps<TValues>,
  "select" | "children"
> & {
  options: FormSelectOption[]
  /**
   * Usa el `<select>` nativo del navegador en vez del menú de MUI. Usarlo
   * dentro de `Modal` (headlessui Dialog): el menú de MUI se abre en un
   * portal fuera del Dialog, y el Dialog lo toma como un click afuera y
   * se cierra.
   */
  native?: boolean
  /** Texto de la opción vacía en modo `native`. */
  placeholder?: string
}

/*

Select con el mismo look que `FormTextField` (TextField `select` de MUI),
para que los desplegables de país, moneda, permisos, etc. se vean y
validen igual que los campos de texto.

*/
export function FormSelectField<TValues extends FieldValues>({
  options,
  native = false,
  placeholder = "Selecciona una opción",
  slotProps,
  ...props
}: FormSelectFieldProps<TValues>) {
  if (native) {
    return (
      <FormTextField
        {...props}
        select
        slotProps={{
          ...slotProps,
          select: { native: true },
          // Con <select> nativo siempre hay un texto visible, así que el
          // label va siempre arriba para no quedar encima.
          inputLabel: { shrink: true },
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FormTextField>
    )
  }

  return (
    <FormTextField {...props} slotProps={slotProps} select>
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </FormTextField>
  )
}

export default FormSelectField
