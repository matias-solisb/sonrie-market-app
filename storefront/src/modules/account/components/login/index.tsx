"use client"

import { login } from "@/lib/data/customer"
import { useActionForm } from "@/lib/forms/use-action-form"
import { loginSchema } from "@/lib/validations/auth"
import {
  AuthCard,
  AuthSubmitButton,
  AuthTitle,
} from "@/modules/account/components/auth-card"
import { LOGIN_VIEW } from "@/modules/account/templates/login-template"
import ErrorMessage from "@/modules/checkout/components/error-message"
import {
  FormPasswordField,
  FormTextField,
} from "@/modules/common/components/form"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"

type Props = {
  // Ya no hay un link a "registrarse" en este diseño (las cuentas vienen de
  // YouOrder.me, no de un registro directo en la tienda) — se sigue
  // recibiendo el setter para mantener la misma interfaz que usa
  // login-template.tsx, pero no se usa acá.
  setCurrentView: (view: LOGIN_VIEW) => void
  // Ruta a la que volver tras loguearse (viene del middleware cuando
  // redirige por falta de sesión). Se manda como campo extra y se lee en
  // el server action `login` (src/lib/data/customer.ts).
  redirectTo?: string
}

/*

zod valida en el cliente (correo con formato válido, contraseña no vacía)
y marca cada campo en rojo; recién si todo es válido se llama al server
action `login`. El error del servidor ("Correo o contraseña incorrectos",
backend caído) llega en `message` y se muestra debajo de los campos.

*/
const Login = ({ setCurrentView: _setCurrentView, redirectTo }: Props) => {
  const {
    form: { control },
    state: message,
    isPending,
    onSubmit,
  } = useActionForm({
    schema: loginSchema,
    action: login,
    initialState: undefined,
    defaultValues: { email: "", password: "" },
    extraFields: { redirect_to: redirectTo },
  })

  return (
    <AuthCard data-testid="login-page">
      <form className="flex w-full flex-col" noValidate onSubmit={onSubmit}>
        <AuthTitle>Bienvenido a Sonríe Market Store</AuthTitle>

        <div className="mt-6 flex flex-col gap-y-4">
          <FormTextField
            control={control}
            name="email"
            label="Correo"
            type="email"
            autoComplete="email"
            slotProps={{ htmlInput: { "data-testid": "email-input" } }}
          />
          <FormPasswordField
            control={control}
            name="password"
            label="Contraseña"
            autoComplete="current-password"
            slotProps={{ htmlInput: { "data-testid": "password-input" } }}
          />
        </div>

        <div className="mt-3 text-right">
          {/* Ruta hermana de `account/` — ver el comentario en
              recover-password/page.tsx. */}
          <LocalizedClientLink
            href="/recover-password"
            className="text-small-regular text-blue-900 hover:underline"
            data-testid="forgot-password-link"
          >
            ¿Olvidaste la contraseña?
          </LocalizedClientLink>
        </div>

        <ErrorMessage error={message} data-testid="login-error-message" />

        <AuthSubmitButton
          isPending={isPending}
          label="Iniciar sesión"
          pendingLabel="Ingresando..."
          data-testid="sign-in-button"
        />
      </form>
    </AuthCard>
  )
}

export default Login
