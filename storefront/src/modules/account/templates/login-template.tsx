"use client"

import Login from "@/modules/account/components/login"

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
}

const LoginTemplate = ({ redirectTo }: Props) => {
  return (
    <div className="flex w-full justify-center px-4 py-10 sm:px-8 sm:py-14">
      <Login setCurrentView={() => {}} redirectTo={redirectTo} />
    </div>
  )
}

export default LoginTemplate
