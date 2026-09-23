"use client"

import TextField, { type TextFieldProps } from "@mui/material/TextField"
import {
  useController,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import FormThemeProvider from "./form-theme-provider"

export type FormTextFieldProps<TValues extends FieldValues> = Omit<
  TextFieldProps,
  "name" | "value" | "defaultValue" | "onChange" | "onBlur" | "error"
> & {
  name: Path<TValues>
  // `any` en los valores transformados: así acepta forms cuyo esquema zod
  // transforma los datos (p.ej. string → number en EmployeesCard), donde
  // `useForm<Input, unknown, Output>` devuelve `Control<Input, unknown, Output>`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<TValues, any, any>
}

/*

TextField de MUI (variant outlined) conectado a react-hook-form. El valor,
el error y el mensaje de error salen del form — el componente que lo usa
solo pasa `name`, `control` y `label`. Cualquier otra prop de TextField
(type, autoComplete, multiline, slotProps…) pasa tal cual.

El `helperText` propio se muestra mientras no haya error; si hay error,
se reemplaza por el mensaje de zod.

*/
export function FormTextField<TValues extends FieldValues>({
  name,
  control,
  helperText,
  ...props
}: FormTextFieldProps<TValues>) {
  const {
    field: { ref, value, ...field },
    fieldState: { error },
  } = useController({ name, control })

  return (
    <FormThemeProvider>
      <TextField
        fullWidth
        {...props}
        {...field}
        value={value ?? ""}
        inputRef={ref}
        error={Boolean(error)}
        helperText={error?.message ?? helperText}
      />
    </FormThemeProvider>
  )
}

export default FormTextField
