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
  FormRutField,
} from "@/modules/common/components/form"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Alert from "@mui/material/Alert"
import Snackbar from "@mui/material/Snackbar"
import { ThemeProvider } from "@mui/material/styles"
import { useParams } from "next/navigation"
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


/*

Login de colaboradores con RUT + clave (rut-auth, paso 5). zod valida el
dígito verificador antes de enviar; el backend normaliza el RUT (puntos,
guion, k minúscula) y responde siempre "RUT o clave incorrectos" ante
cualquier falla. Si el colaborador tiene pendiente el cambio de clave
inicial, el server action `login` lo manda a /cambiar-clave.

*/
const Login = ({ setCurrentView: _setCurrentView, redirectTo }: Props) => {
  const { countryCode } = useParams<{ countryCode: string }>()
  const {
    form: { control, reset, getValues },
    state: message,
    isPending,
    onSubmit,
  } = useActionForm({
    schema: loginSchema,
    action: login,
    initialState: undefined,
    defaultValues: { rut: "", password: "" },
    extraFields: { redirect_to: redirectTo, country_code: countryCode },
  })
  
  const [alertOpen, setAlertOpen] = useState(false)

  useEffect(() => {
    if (isPending) {
      setAlertOpen(false)
      // Si el login funciona, el action hace redirect() al home. Next no
      // vuelve arriba cuando el inicio del home ya cabe en pantalla
      // (layout-router: topOfElementInViewport), así que conservaría el
      // scroll de este formulario y el home aparecería corrido hacia abajo.
      window.scrollTo({ top: 0 })
    } else if (message) {
      setAlertOpen(true)
      // Junto con la alerta se vacía la contraseña; el RUT se conserva para
      // reintentar sin volver a escribirlo.
      reset({ rut: getValues("rut"), password: "" })
    }
  }, [isPending, message, reset, getValues])

  return (
    <AuthCard data-testid="login-page">
      <form className="flex w-full flex-col" noValidate onSubmit={onSubmit}>
        <AuthTitle>Bienvenido a Sonríe Market Store</AuthTitle>

        <div className="mt-6 flex flex-col gap-y-4">
          <FormRutField
            control={control}
            name="rut"
            label="RUT"
            placeholder="12.345.678-9"
            autoComplete="username"
            slotProps={{ htmlInput: { "data-testid": "rut-input" } }}
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
