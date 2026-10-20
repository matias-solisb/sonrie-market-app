"use client"

import {
  forcedChangePassword,
  signout,
  type ChangePasswordResult,
} from "@/lib/data/customer"
import { useActionForm } from "@/lib/forms/use-action-form"
import { changePasswordSchema } from "@/lib/validations/auth"
import {
  AuthCard,
  AuthSubmitButton,
  AuthText,
  AuthTitle,
} from "@/modules/account/components/auth-card"
import ErrorMessage from "@/modules/checkout/components/error-message"
import { FormPasswordField } from "@/modules/common/components/form"
import { useEffect } from "react"

const initialState: ChangePasswordResult = {}

type Props = {
  countryCode: string
}

/*

Cambio de clave obligatorio (rut-auth, paso 6). Lo ve el colaborador en su
primer ingreso, cuando todavía tiene la clave inicial: el backend le bloquea
la tienda (403 password_change_required) hasta que la cambie.

Pide la clave actual a propósito: si alguien se roba la sesión en este
momento, no puede fijar su propia clave sin conocer la inicial.

zod valida largo mínimo y que ambas coincidan; el backend verifica la clave
actual y la política (sin números del RUT) y devuelve el mensaje que se
muestra bajo el campo que corresponde. En éxito, el server action redirige
a la tienda.

*/
const ForcedPasswordChange = ({ countryCode }: Props) => {
  const {
    form: { control, setError },
    state,
    isPending,
    onSubmit,
  } = useActionForm({
    schema: changePasswordSchema,
    action: forcedChangePassword,
    initialState,
    defaultValues: { current_password: "", password: "", repeat_password: "" },
    extraFields: { country_code: countryCode },
  })

  useEffect(() => {
    if (state.error && state.field) {
      setError(state.field, { message: state.error })
    }
  }, [state, setError])

  return (
    <AuthCard data-testid="forced-password-change-page">
      <form className="flex w-full flex-col" noValidate onSubmit={onSubmit}>
        <AuthTitle>Cambia tu contraseña</AuthTitle>
        <AuthText>
          Es tu primer ingreso. Antes de comprar, reemplaza la contraseña
          inicial por una propia de al menos 8 caracteres, que no incluya
          números de tu RUT.
        </AuthText>

        <div className="mt-6 flex flex-col gap-y-4">
          <FormPasswordField
            control={control}
            name="current_password"
            label="Contraseña actual"
            helperText="Son los últimos 4 dígitos de tu RUT, antes del guion."
            autoComplete="current-password"
            slotProps={{
              htmlInput: { "data-testid": "current-password-input" },
            }}
          />
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
            label="Repetir contraseña nueva"
            autoComplete="new-password"
            slotProps={{
              htmlInput: { "data-testid": "repeat-password-input" },
            }}
          />
        </div>

        {/* Errores sin campo (sesión vencida, backend caído) */}
        <ErrorMessage
          error={state.field ? undefined : state.error}
          data-testid="forced-password-change-error"
        />

        <AuthSubmitButton
          isPending={isPending}
          label="Guardar y continuar"
          pendingLabel="Guardando..."
          data-testid="forced-password-change-submit"
        />
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => signout(countryCode, "")}
          className="text-small-regular font-semibold text-ui-fg-base hover:underline"
          data-testid="forced-password-change-signout"
        >
          Cerrar sesión
        </button>
      </div>
    </AuthCard>
  )
}

export default ForcedPasswordChange
