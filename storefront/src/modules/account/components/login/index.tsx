import { login } from "@/lib/data/customer"
import { LOGIN_VIEW } from "@/modules/account/templates/login-template"
import ErrorMessage from "@/modules/checkout/components/error-message"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Eye from "@/modules/common/icons/eye"
import EyeOff from "@/modules/common/icons/eye-off"
import Image from "next/image"
import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"

const LOGO_URL =
  "https://s3.amazonaws.com/production-clients-images/sonrie.youorder.me/others/LOGO-Sonri%CC%81e-Market%20%28002%29.png"

type Props = {
  // Ya no hay un link a "registrarse" en este diseño (las cuentas vienen de
  // YouOrder.me, no de un registro directo en la tienda) — se sigue
  // recibiendo el setter para mantener la misma interfaz que usa
  // login-template.tsx, pero no se usa acá.
  setCurrentView: (view: LOGIN_VIEW) => void
  // Ruta a la que volver tras loguearse (viene del middleware cuando
  // redirige por falta de sesión). Se manda como input oculto y se lee en
  // el server action `login` (src/lib/data/customer.ts).
  redirectTo?: string
}

// El borde/color cambian a rojo cuando `login` devolvió un error, para que
// el campo se vea igual que un error de validación (borde + texto en rojo).
const getInputClassName = (hasError: boolean) =>
  `h-11 w-full rounded-md border px-4 text-base-regular text-ui-fg-base placeholder:text-ui-fg-subtle focus:outline-none focus:ring-0 ${
    hasError
      ? "border-rose-500 focus:border-rose-500"
      : "border-ui-border-base focus:border-ui-border-interactive"
  }`

const LoginSubmitButton = () => {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-blue-900 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      data-testid="sign-in-button"
    >
      {pending ? "Ingresando..." : "Iniciar sesión"}
    </button>
  )
}

const Login = ({ setCurrentView: _setCurrentView, redirectTo }: Props) => {
  const [message, formAction] = useActionState(login, null)
  const [showPassword, setShowPassword] = useState(false)

  // `message` es el string de error que devuelve el server action `login`
  // (src/lib/data/customer.ts) cuando falla, o null/undefined si no hubo
  // intento o si fue exitoso (ahí ya se hizo redirect en el server).
  const hasError = Boolean(message)

  return (
    <div
      className="w-full max-w-md rounded-md border border-ui-border-base p-6 sm:p-8"
      data-testid="login-page"
    >
      {/* Todo el contenido visible (logo, textos y campos) queda encerrado
          en un único <form>, en vez de tener el logo/título/subtítulo fuera
          y solo los inputs adentro. */}
      <form className="flex w-full flex-col" action={formAction}>
        {redirectTo && (
          <input type="hidden" name="redirect_to" value={redirectTo} />
        )}
        <Image
          src={LOGO_URL}
          alt="Sonríe Market"
          width={320}
          height={88}
          className="mx-auto mb-6 h-16 w-auto sm:mb-8 sm:h-24"
        />

        <h1 className="text-xl-semi text-ui-fg-base sm:text-2xl-semi">
          Bienvenido a Sonríe Market Store
        </h1>
        {/* <p className="mt-3 text-base-regular text-ui-fg-subtle">
          Utiliza tu cuenta xxxx para acceder al catálogo de Sonríe
          Market Store.
        </p> */}

        <div className="mt-6 flex flex-col gap-y-3">
          <input
            type="email"
            name="email"
            placeholder="Correo"
            title="Ingresa un correo válido."
            autoComplete="email"
            required
            className={getInputClassName(hasError)}
            data-testid="email-input"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Contraseña"
              autoComplete="current-password"
              required
              className={`${getInputClassName(hasError)} pr-11`}
              data-testid="password-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ui-fg-subtle hover:text-ui-fg-base"
            >
              {showPassword ? <Eye /> : <EyeOff />}
            </button>
          </div>
        </div>

        <div className="mt-3 text-right">
          {/* Vista en src/modules/account/components/recover-password —
              ver el comentario en su page.tsx (recover-password/page.tsx)
              sobre por qué es una ruta hermana de `account/` y no algo
              anidado adentro. */}
          <LocalizedClientLink
            href="/recover-password"
            className="text-small-regular text-blue-900 hover:underline"
            data-testid="forgot-password-link"
          >
            ¿Olvidaste la contraseña?
          </LocalizedClientLink>
        </div>

        <ErrorMessage error={message} data-testid="login-error-message" />

        <LoginSubmitButton />
      </form>
    </div>
  )
}

export default Login
