"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  useForm,
  type FieldValues,
  type Resolver,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form"
import type { z } from "zod"

type AnyFormSchema = z.ZodType<FieldValues, z.ZodTypeDef, FieldValues>

/*

`useForm` de react-hook-form ya conectado a un esquema zod. Los tipos salen
del esquema, así que no hay que repetirlos:

- lo que se edita en los campos es `z.input<schema>`
- lo que recibe `handleSubmit` es `z.output<schema>` (ya validado y, si el
  esquema tiene `.transform()`, ya transformado — p.ej. EmployeesCard
  convierte el límite de gasto de string a número)

Úsalo para formularios que llaman a una función normal. Si el formulario
envía a un server action, usa `useActionForm`, que se apoya en este hook.

*/
export function useZodForm<TSchema extends AnyFormSchema>(
  schema: TSchema,
  options: Omit<
    UseFormProps<z.input<TSchema>, unknown, z.output<TSchema>>,
    "resolver"
  > = {}
): UseFormReturn<z.input<TSchema>, unknown, z.output<TSchema>> {
  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    ...options,
    resolver: zodResolver(schema) as Resolver<
      z.input<TSchema>,
      unknown,
      z.output<TSchema>
    >,
  })
}
