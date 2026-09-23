"use client"

import {
  requestPasswordReset,
  type PasswordResetActionState,
} from "@/lib/data/customer"
import { useActionForm } from "@/lib/forms/use-action-form"
import { recoverPasswordSchema } from "@/lib/validations/auth"
import {
  AuthCard,
  AuthSubmitButton,
  AuthText,
  AuthTitle,
} from "@/modules/account/components/auth-card"
import ErrorMessage from "@/modules/checkout/components/error-message"
import { FormTextField } from "@/modules/common/components/form"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"

const initialState: PasswordResetActionState = {}

/*

Paso 1 de "Olvidé mi contraseña": pide el email y llama al server action
`requestPasswordReset` (src/lib/data/customer.ts), calcando el diseño de
referencia (sonrie.youorder.me/auth/jwt/recover).

En éxito NO se redirige: se reemplaza el formulario por un mensaje de
confirmación en la misma card (`state.success`), porque el backend responde
201 tanto si el email existe como si no (para no filtrar qué cuentas están
registradas) — "éxito" solo significa "la solicitud se procesó".

*/
const RecoverPasswordForm = () => {
  const {
    form: { control },
    state,
    isPending,
    onSubmit,
  } = useActionForm({
    schema: recoverPasswordSchema,
    action: requestPasswordReset,
    initialState,
    defaultValues: { email: "" },
  })

  return (
    <AuthCard data-testid="recover-password-page">
      {state.success ? (
        <>
          <AuthTitle>Recuperar contraseña</AuthTitle>
          <AuthText>
            Si el correo que ingresaste está registrado, te enviamos
            instrucciones para recuperar tu contraseña. Revisa tu bandeja de
            entrada.
          </AuthText>
        </>
      ) : (
        <form className="flex w-full flex-col" noValidate onSubmit={onSubmit}>
          <AuthTitle>Recuperar contraseña</AuthTitle>
          <AuthText>
            Te enviaremos un correo con instrucciones para recuperar tu
            contraseña.
          </AuthText>

          <div className="mt-6">
            <FormTextField
              control={control}
              name="email"
              label="Correo"
              type="email"
              autoComplete="email"
              slotProps={{
                htmlInput: { "data-testid": "recover-password-email-input" },
              }}
            />
          </div>

          <ErrorMessage
            error={state.error}
            data-testid="recover-password-error-message"
          />

          <AuthSubmitButton
            isPending={isPending}
            label="Enviar"
            pendingLabel="Enviando..."
            data-testid="recover-password-submit-button"
          />
        </form>
      )}

      <div className="mt-4 text-center">
        <LocalizedClientLink
          href="/account"
          className="text-small-regular font-semibold text-ui-fg-base hover:underline"
          data-testid="back-to-login-link"
        >
          Volver al Login
        </LocalizedClientLink>
      </div>
    </AuthCard>
  )
}

export default RecoverPasswordForm
