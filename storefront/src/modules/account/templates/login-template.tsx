"use client"

import Login from "@/modules/account/components/login"

// Se mantiene el enum (aunque ya solo tenga un valor útil, y con el mismo
// nombre LOG_IN que traía el B2B Starter) porque login/index.tsx sigue
// tipando su prop `setCurrentView` con él, y register/index.tsx (sin tocar,
// componente hoy inalcanzable desde la UI) también referencia
// LOGIN_VIEW.LOG_IN al volver de "registrarse" a "iniciar sesión".
export enum LOGIN_VIEW {
  LOG_IN = "log-in",
}

// El registro propio (Register) se retiró de este flujo: las cuentas de
// Sonríe Market no se crean desde la tienda (vienen del alta SAP / módulo
// rut-auth), así que ya no hay una vista alternativa a la que cambiar acá.
const LoginTemplate = () => {
  return (
    <div className="flex w-full justify-center px-4 py-10 sm:px-8 sm:py-14">
      <Login setCurrentView={() => {}} />
    </div>
  )
}

export default LoginTemplate
