"use client"

import { useZodForm } from "@/lib/forms/use-zod-form"
import {
  contactSchema,
  type ContactFormValues,
} from "@/lib/validations/contact"
import {
  FormSubmitButton,
  FormTextField,
} from "@/modules/common/components/form"

/*

Formulario de /contact, calcado del sitio legacy (sonrie.youorder.me).
Usa los campos compartidos de `common/components/form` (MUI TextField +
react-hook-form) y el esquema zod de `lib/validations/contact`.

Por ahora `onSubmit` no envía nada: falta definir a dónde llega el mensaje
(correo / endpoint del backend). Cuando exista un server action, este form
puede pasar a `useActionForm` como login o recover-password.

*/
const ContactForm = () => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useZodForm(contactSchema, {
    defaultValues: { name: "", email: "", phone: "", message: "" },
  })

  const onSubmit = async (values: ContactFormValues) => {
    // TODO: enviar el mensaje cuando se defina el destino.
    console.info("Contacto:", values)
    reset()
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6"
      data-testid="contact-form"
    >
      <FormTextField
        control={control}
        name="name"
        label="Nombre"
        autoComplete="name"
      />
      <FormTextField
        control={control}
        name="email"
        label="Correo"
        type="email"
        autoComplete="email"
      />
      <FormTextField
        control={control}
        name="phone"
        label="Teléfono"
        type="tel"
        autoComplete="tel"
      />
      <FormTextField
        control={control}
        name="message"
        label="Mensaje"
        multiline
        rows={4}
      />

      <div className="flex justify-end">
        <FormSubmitButton
          isPending={isSubmitting}
          pendingLabel="Enviando..."
          className="h-12 rounded-lg px-5 text-base"
          data-testid="contact-submit-button"
        >
          Enviar
        </FormSubmitButton>
      </div>
    </form>
  )
}

export default ContactForm
