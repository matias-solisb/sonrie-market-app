"use client"

import { startTransition, useActionState, useEffect, useRef } from "react"
import type { DefaultValues, UseFormReturn } from "react-hook-form"
import type { z } from "zod"

import { toFormData } from "@/lib/forms/to-form-data"
import { useZodForm } from "@/lib/forms/use-zod-form"

type AnyFormSchema = Parameters<typeof useZodForm>[0]

type UseActionFormOptions<TSchema extends AnyFormSchema, TState> = {
  schema: TSchema
  /** Server action existente, con la firma que espera `useActionState`. */
  // `NoInfer`: TState se deduce de lo que DEVUELVE el action (e
  // `initialState`), no de su primer parámetro — varios actions lo tipan
  // como `unknown`, lo que dejaba `state` como unknown.
  action: (
    state: NoInfer<TState>,
    formData: FormData
  ) => TState | Promise<TState>
  initialState: TState
  defaultValues: DefaultValues<z.input<TSchema>>
  /**
   * Campos que no se editan pero el server action necesita
   * (ej. `redirect_to`, `token`). Reemplaza a los `<input type="hidden">`.
   */
  extraFields?: Record<string, string | undefined>
  /**
   * Se llama una vez por cada envío cuyo estado trae `success: true`
   * (p.ej. para cerrar un modal). Puede usar funciones declaradas después
   * del hook si se pasa como `() => close()`.
   */
  onSuccess?: (state: TState) => void
}

type UseActionFormReturn<TSchema extends AnyFormSchema, TState> = {
  form: UseFormReturn<z.input<TSchema>, unknown, z.output<TSchema>>
  /** Lo que devolvió el server action en el último envío. */
  state: TState
  isPending: boolean
  /** Para `<form onSubmit={onSubmit} noValidate>`. */
  onSubmit: (event?: React.BaseSyntheticEvent) => Promise<void>
}

/*

Une react-hook-form + zod (vía `useZodForm`) con un server action:

1. `handleSubmit` valida con zod; si algo falla, cada campo muestra su
   error y el server action NO se llama.
2. Si todo es válido, se arma un FormData y se despacha el action dentro
   de `startTransition` (requisito de React para llamar al dispatch de
   `useActionState` fuera de `<form action>`). `redirect()` dentro del
   action sigue funcionando igual.
3. Los errores del servidor (credenciales inválidas, backend caído) siguen
   llegando en `state`, como antes.

Ojo: como el envío ya no pasa por `<form action>`, `useFormStatus` deja de
enterarse — para el estado "Enviando..." se usa `isPending`.

*/
export function useActionForm<TSchema extends AnyFormSchema, TState>({
  schema,
  action,
  initialState,
  defaultValues,
  extraFields,
  onSuccess,
}: UseActionFormOptions<TSchema, TState>): UseActionFormReturn<
  TSchema,
  TState
> {
  const [state, dispatch, isPending] = useActionState(
    action as (
      state: Awaited<TState>,
      formData: FormData
    ) => TState | Promise<TState>,
    initialState as Awaited<TState>
  )

  const form = useZodForm(schema, { defaultValues })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch(toFormData({ ...values, ...extraFields }))
    })
  })

  // Se guarda el callback en un ref para que el efecto dependa solo de
  // `state`: cada envío devuelve un objeto nuevo, así que corre una vez por
  // envío (y no en cada render aunque `onSuccess` sea una función nueva).
  const onSuccessRef = useRef(onSuccess)
  useEffect(() => {
    onSuccessRef.current = onSuccess
  })

  useEffect(() => {
    const result = state as { success?: boolean } | null | undefined
    if (result && typeof result === "object" && result.success) {
      onSuccessRef.current?.(state as TState)
    }
  }, [state])

  return { form, state: state as TState, isPending, onSubmit }
}
