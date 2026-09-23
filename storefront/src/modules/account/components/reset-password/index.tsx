"use client"

import {
  resetPassword,
  type PasswordResetActionState,
} from "@/lib/data/customer"
import { useActionForm } from "@/lib/forms/use-action-form"
import { resetPasswordSchema } from "@/lib/validations/auth"
import {
  AuthCard,
  AuthSubmitButton,
  AuthText,
  AuthTitle,
} from "@/modules/account/components/auth-card"
import ErrorMessage from "@/modules/checkout/components/error-message"
import { FormPasswordField } from "@/modules/common/components/form"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"

const initialState: PasswordResetActionState = {}

type Props = {
  // Viene del query param `token` de la URL (ver reset-password/page.tsx),
  // el mismo token que arma el subscriber del backend
  // (customer-password-reset.ts) al construir el link del correo.
  // `undefined` = se entró sin token (link roto o copiado a medias): no hay
  // forma de completar el flujo, así que ni se muestra el formulario.
  token?: string
}

/*

Paso 2 de "Olvidé mi contraseña" — la vista que abre el link del correo.
zod valida largo mínimo y que ambas contraseñas coincidan (el error queda
en "Repetir contraseña"); el server action `resetPassword` lo vuelve a
comprobar y además valida el token.

*/
const ResetPasswordForm = ({ token }: Props) => {
  const {
    form: { control },
    state,
    isPending,
    onSubmit,
  } = useActionForm({
    schema: resetPasswordSchema,
    action: resetPassword,
    initialState,
    defaultValues: { password: "", repeat_password: "" },
    extraFields: { token },
  })

  return (
    <AuthCard data-testid="reset-password-page">
      {!token ? (
        <>
          <AuthTitle>Link no válido</AuthTitle>
          <AuthText>
            Este link de recuperación no es válido o está incompleto.
            Solicita uno nuevo.
          </AuthText>
        </>
      ) : state.success ? (
        <>
          <AuthTitle>Contraseña actualizada</AuthTitle>
          <AuthText>
            Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión
            con tu contraseña nueva.
          </AuthText>
        </>
      ) : (
        <form className="flex w-full flex-col" noValidate onSubmit={onSubmit}>
          <AuthTitle>Nueva contraseña</AuthTitle>
          <AuthText>Ingresa tu contraseña nueva.</AuthText>

          <div className="mt-6 flex flex-col gap-y-4">
            <FormPasswordField
              control={control}
              name="password"
              label="Contraseña nueva"
              autoComplete="new-password"
              slotProps={{ htmlInput: { "data-testid": "password-input" } }}
            />
            <FormPasswordField
              control={control}
              name="repeat_password"
              label="Repetir contraseña"
              autoComplete="new-password"
              slotProps={{
                htmlInput: { "data-testid": "repeat_password-input" },
              }}
            />
          </div>

          <ErrorMessage
            error={state.error}
            data-testid="reset-password-error-message"
          />

          <AuthSubmitButton
            isPending={isPending}
            label="Guardar contraseña"
            pendingLabel="Guardando..."
            data-testid="reset-password-submit-button"
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

export default ResetPasswordForm
