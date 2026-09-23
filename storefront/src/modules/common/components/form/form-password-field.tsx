"use client"

import IconButton from "@mui/material/IconButton"
import InputAdornment from "@mui/material/InputAdornment"
import { useState } from "react"
import type { FieldValues } from "react-hook-form"

import Eye from "@/modules/common/icons/eye"
import EyeOff from "@/modules/common/icons/eye-off"

import { FormTextField, type FormTextFieldProps } from "./form-text-field"

type FormPasswordFieldProps<TValues extends FieldValues> = Omit<
  FormTextFieldProps<TValues>,
  "type"
>

/*

`FormTextField` de contraseña con el botón de mostrar/ocultar (el ojo)
como adornment al final del campo. Reemplaza los `PasswordInput` que
estaban duplicados en login, reset-password y profile-card.

*/
export function FormPasswordField<TValues extends FieldValues>({
  slotProps,
  ...props
}: FormPasswordFieldProps<TValues>) {
  const [visible, setVisible] = useState(false)

  return (
    <FormTextField
      {...props}
      type={visible ? "text" : "password"}
      slotProps={{
        ...slotProps,
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {visible ? <Eye size="18" /> : <EyeOff size="18" />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
}

export default FormPasswordField
