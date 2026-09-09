"use client"

import {
  requestPasswordReset,
  type PasswordResetActionState,
} from "@/lib/data/customer"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import ErrorMessage from "@/modules/checkout/components/error-message"
import Image from "next/image"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"

// Mismo logo que usa el login (login/index.tsx) — se duplica acá en vez
// de importarlo porque no está exportado desde ese archivo; si cambia en
// uno, hay que cambiarlo en el otro.
const LOGO_URL =
  "https://s3.amazonaws.com/production-clients-images/sonrie.youorder.me/others/LOGO-Sonri%CC%81e-Market%20%28002%29.png"

// Mismas clases que usa login/index.tsx para su input de email — se
// duplica en vez de compartir un helper porque login/index.tsx no lo
// exporta (mismo criterio que con LOGO_URL).
const getInputClassName = (hasError: boolean) =>
  `h-11 w-full rounded-md border px-4 text-base-regular text-ui-fg-base placeholder:text-ui-fg-subtle focus:outline-none focus:ring-0 ${
    hasError
      ? "border-rose-500 focus:border-rose-500"
      : "border-ui-border-base focus:border-ui-border-interactive"
  }`

const SubmitButton = () => {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-blue-900 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      data-testid="recover-password-submit-button"
    >
      {pending ? "Enviando..." : "Enviar"}
    </button>
  )
}

const initialState: PasswordResetActionState = {}

/*

Paso 1 de "Olvidé mi contraseña": pide el email y llama al server action
`requestPasswordReset` (src/lib/data/customer.ts). Mismo estilo de card
que `Login` (mismo wrapper, mismo logo, mismos inputs) para que se vea
como parte del mismo flujo, calcando el diseño de referencia
(sonrie.youorder.me/auth/jwt/recover).

En éxito NO se redirige a ningún lado ni se limpia a otra vista aparte:
se reemplaza el formulario por un mensaje de confirmación en la misma
card (`state.success`), porque el backend responde 201 tanto si el email
existe como si no (para no filtrar qué cuentas están registradas) — o
sea que "éxito" acá solo significa "la solicitud se procesó", no "el
correo llegó a una cuenta real".

*/
const RecoverPasswordForm = () => {
  const [state, formAction] = useActionState(
    requestPasswordReset,
    initialState
  )

  return (
    <div
      className="w-full max-w-md rounded-md border border-ui-border-base p-6 sm:p-8"
      data-testid="recover-password-page"
    >
      <Image
        src={LOGO_URL}
        alt="Sonríe Market"
        width={320}
        height={88}
        className="mx-auto mb-6 h-16 w-auto sm:mb-8 sm:h-24"
      />

      {state.success ? (
        <>
          <h1 className="text-xl-semi text-ui-fg-base sm:text-2xl-semi">
            Recuperar contraseña
          </h1>
          <p className="mt-3 text-base-regular text-ui-fg-subtle">
            Si el correo que ingresaste está registrado, te enviamos
            instrucciones para recuperar tu contraseña. Revisa tu bandeja de
            entrada.
          </p>
        </>
      ) : (
        <form className="flex w-full flex-col" action={formAction}>
          <h1 className="text-xl-semi text-ui-fg-base sm:text-2xl-semi">
            Recuperar contraseña
          </h1>
          <p className="mt-3 text-base-regular text-ui-fg-subtle">
            Te enviaremos un correo con instrucciones para recuperar tu
            contraseña.
          </p>

          <div className="mt-6">
            <input
              type="email"
              name="email"
              placeholder="Email address"
              title="Ingresa un correo válido."
              autoComplete="email"
              required
              className={getInputClassName(Boolean(state.error))}
              data-testid="recover-password-email-input"
            />
          </div>

          <ErrorMessage
            error={state.error}
            data-testid="recover-password-error-message"
          />

          <SubmitButton />
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
    </div>
  )
}

export default RecoverPasswordForm
