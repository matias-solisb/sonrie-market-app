"use client"

import { muiTheme } from "@/lib/mui/theme"
import Login from "@/modules/account/components/login"
import Alert from "@mui/material/Alert"
import { ThemeProvider } from "@mui/material/styles"

// Se mantiene el enum (aunque ya solo tenga un valor útil, y con el mismo
// nombre LOG_IN que traía el B2B Starter) porque login/index.tsx sigue
// tipando su prop `setCurrentView` con él.
export enum LOGIN_VIEW {
  LOG_IN = "log-in",
}

// No hay registro propio: las cuentas de Sonríe Market no se crean desde la
// tienda (las crea la plataforma con el alta de colaboradores), así que no
// hay una vista alternativa a la que cambiar acá.
type Props = {
  redirectTo?: string
  /** La sesión se cerró porque la cuenta fue deshabilitada (paso 9). */
  sessionClosed?: boolean
}

const LoginTemplate = ({ redirectTo, sessionClosed }: Props) => {
  return (
    <div className="flex w-full flex-col items-center gap-y-4 px-4 py-10 sm:px-8 sm:py-14">
      {sessionClosed && (
        <ThemeProvider theme={muiTheme}>
          <Alert
            severity="warning"
            className="w-full max-w-md"
            data-testid="session-closed-message"
          >
            Tu sesión se cerró. Si no puedes volver a ingresar, contacta a tu
            administrador.
          </Alert>
        </ThemeProvider>
      )}
      <Login setCurrentView={() => {}} redirectTo={redirectTo} />
    </div>
  )
}

export default LoginTemplate
