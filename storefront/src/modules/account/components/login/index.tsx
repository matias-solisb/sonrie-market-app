"use client"

import { login } from "@/lib/data/customer"
import { useActionForm } from "@/lib/forms/use-action-form"
import { loginSchema } from "@/lib/validations/auth"
import {
  AuthCard,
  AuthSubmitButton,
  AuthTitle,
} from "@/modules/account/components/auth-card"
import { muiTheme } from "@/lib/mui/theme"
import { LOGIN_VIEW } from "@/modules/account/templates/login-template"
import {
  FormPasswordField,
  FormTextField,
} from "@/modules/common/components/form"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Alert from "@mui/material/Alert"
import Snackbar from "@mui/material/Snackbar"
import { ThemeProvider } from "@mui/material/styles"
import { useEffect, useState } from "react"

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


const Login = ({ setCurrentView: _setCurrentView, redirectTo }: Props) => {
  const {
    form: { control, reset },
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
  
  const [alertOpen, setAlertOpen] = useState(false)

  useEffect(() => {
    if (isPending) {
      setAlertOpen(false)
    } else if (message) {
      setAlertOpen(true)
      // Junto con la alerta se vacían correo y contraseña.
      reset({ email: "", password: "" })
    }
  }, [isPending, message, reset])

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

        <ThemeProvider theme={muiTheme}>
          <Snackbar
            open={alertOpen && !!message}
            autoHideDuration={6000}
            onClose={(_event, reason) => {
              if (reason !== "clickaway") setAlertOpen(false)
            }}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          >
            <Alert
              severity="error"
              variant="filled"
              onClose={() => setAlertOpen(false)}
              data-testid="login-error-message"
              sx={{ alignItems: "center", fontSize: 15 }}
            >
              {message}
            </Alert>
          </Snackbar>
        </ThemeProvider>

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
