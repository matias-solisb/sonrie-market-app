"use client"

import {
  resetPassword,
  type PasswordResetActionState,
} from "@/lib/data/customer"
import ErrorMessage from "@/modules/checkout/components/error-message"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Eye from "@/modules/common/icons/eye"
import EyeOff from "@/modules/common/icons/eye-off"
import Image from "next/image"
import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"

// Mismo logo/clases que login/index.tsx y recover-password/index.tsx —
// ver el comentario de por qué se duplica en vez de compartirse.
const LOGO_URL =
  "https://s3.amazonaws.com/production-clients-images/sonrie.youorder.me/others/LOGO-Sonri%CC%81e-Market%20%28002%29.png"

const getInputClassName = (hasError: boolean) =>
  `h-11 w-full rounded-md border px-4 text-base-regular text-ui-fg-base placeholder:text-ui-fg-subtle focus:outline-none focus:ring-0 ${
    hasError
      ? "border-rose-500 focus:border-rose-500"
      : "border-ui-border-base focus:border-ui-border-interactive"
  }`

const PasswordInput = ({
  name,
  placeholder,
  hasError,
  autoComplete,
}: {
  name: string
  placeholder: string
  hasError: boolean
  autoComplete: string
}) => {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        minLength={8}
        className={`${getInputClassName(hasError)} pr-11`}
        data-testid={`${name}-input`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ui-fg-subtle hover:text-ui-fg-base"
      >
        {visible ? <Eye /> : <EyeOff />}
      </button>
    </div>
  )
}

const SubmitButton = () => {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-blue-900 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      data-testid="reset-password-submit-button"
    >
      {pending ? "Guardando..." : "Guardar contraseña"}
    </button>
  )
}

const initialState: PasswordResetActionState = {}

type Props = {
  // Viene del query param `token` de la URL (ver reset-password/page.tsx),
  // el mismo token que arma el subscriber del backend
  // (customer-password-reset.ts) al construir el link del correo.
  // `undefined` significa que se entró a esta vista sin token — link roto,
  // copiado a medias, o alguien navegando la URL a mano — no hay forma de
  // completar el flujo así que ni se muestra el formulario.
  token?: string
}

/*

Paso 2 de "Olvidé mi contraseña" — la vista que abre el link del correo
(hoy, mientras no hay un servicio de correo real conectado, el link sale
en la consola del backend, ver el subscriber). Mismo estilo de card que
Login/RecoverPasswordForm.

*/
const ResetPasswordForm = ({ token }: Props) => {
  const [state, formAction] = useActionState(resetPassword, initialState)

  return (
    <div
      className="w-full max-w-md rounded-md border border-ui-border-base p-6 sm:p-8"
      data-testid="reset-password-page"
    >
      <Image
        src={LOGO_URL}
        alt="Sonríe Market"
        width={320}
        height={88}
        className="mx-auto mb-6 h-16 w-auto sm:mb-8 sm:h-24"
      />

      {!token ? (
        <>
          <h1 className="text-xl-semi text-ui-fg-base sm:text-2xl-semi">
            Link no válido
          </h1>
          <p className="mt-3 text-base-regular text-ui-fg-subtle">
            Este link de recuperación no es válido o está incompleto.
            Solicita uno nuevo.
          </p>
        </>
      ) : state.success ? (
        <>
          <h1 className="text-xl-semi text-ui-fg-base sm:text-2xl-semi">
            Contraseña actualizada
          </h1>
          <p className="mt-3 text-base-regular text-ui-fg-subtle">
            Tu contraseña se actualizó correctamente. Ya puedes iniciar
            sesión con tu contraseña nueva.
          </p>
        </>
      ) : (
        <form className="flex w-full flex-col" action={formAction}>
          <input type="hidden" name="token" value={token} />

          <h1 className="text-xl-semi text-ui-fg-base sm:text-2xl-semi">
            Nueva contraseña
          </h1>
          <p className="mt-3 text-base-regular text-ui-fg-subtle">
            Ingresa tu contraseña nueva.
          </p>

          <div className="mt-6 flex flex-col gap-y-3">
            <PasswordInput
              name="password"
              placeholder="Contraseña nueva"
              autoComplete="new-password"
              hasError={Boolean(state.error)}
            />
            <PasswordInput
              name="repeat_password"
              placeholder="Repetir contraseña"
              autoComplete="new-password"
              hasError={Boolean(state.error)}
            />
          </div>

          <ErrorMessage
            error={state.error}
            data-testid="reset-password-error-message"
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

export default ResetPasswordForm
