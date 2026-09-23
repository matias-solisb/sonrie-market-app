"use client"

import { changePassword, updateCustomer } from "@/lib/data/customer"
import { useZodForm } from "@/lib/forms/use-zod-form"
import { muiTheme } from "@/lib/mui/theme"
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/lib/validations/auth"
import {
  profileSchema,
  type ProfileFormValues,
} from "@/lib/validations/profile"
import {
  FormCancelButton,
  FormPasswordField,
  FormReadOnlyField,
  FormSubmitButton,
  FormTextField,
} from "@/modules/common/components/form"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { showSuccessToast } from "@/modules/common/components/success-toast"
import { B2BCustomer } from "@/types/global"
import { Checkbox, Container, Text, toast } from "@medusajs/ui"
import InputAdornment from "@mui/material/InputAdornment"
import OutlinedInput from "@mui/material/OutlinedInput"
import { ThemeProvider } from "@mui/material/styles"
import { useMemo, useState, type ReactNode } from "react"
import { Controller } from "react-hook-form"
import PhoneCountrySelect, {
  getDialCode,
  parsePhoneNumber,
} from "@/modules/account/components/profile-card/phone-country-select"

/*

Card "Mis datos". El título "Mis datos" y el link "Editar Datos" van
FUERA del recuadro blanco (`Container`) — viven en este mismo componente
para poder togglear `isEditing`, pero se renderizan como hermanos del
`Container`, no dentro de él, para que queden por fuera visualmente
(según la referencia).

Nombre/Apellido/Teléfono siguen editables vía `updateCustomer`. Dirección
e "ID del comercio" son de solo lectura (ver comentario más abajo).
Contraseña y Notificaciones antes vivían en un `SecurityCard` aparte con
su propio recuadro — se fusionaron acá, como secciones del mismo card, que
es como las muestra la referencia.

El bloque de "Nombre/Teléfono/Email/ID del comercio" es UN solo grid
(no dos JSX separados para "ver" y "editar" alternados con animación de
colapso, como había antes): cada campo decide con `isEditing ? <input> :
<Text>` qué mostrar. Se simplificó así a propósito — la versión con dos
bloques duplicaba cada campo y terminó rompiéndose (un campo duplicado y
los botones de guardar quedando atrapados dentro del bloque que se
colapsaba). El costo es que ya no hay animación de alto/opacidad al
entrar o salir de edición.

Los separadores entre secciones (Dirección/Contraseña/Notificaciones, y el
bloque de datos de arriba) NO son un `border-b` de ancho completo — son un
div de 1px propio (`h-px bg-neutral-200`) con margen derecho (`mr-10`)
para que la línea quede corta y no toque el borde derecho del recuadro,
tal como pide la referencia. Se pone como hermano después de cada sección
(no como borde del contenedor).

- Los dos formularios de la card ("Editar Datos" y "Cambiar contraseña")
  usan los campos compartidos de `common/components/form` (TextField de
  MUI + react-hook-form) con esquemas zod (`lib/validations/profile` y
  `lib/validations/auth`): cada error se muestra en su campo.
- "Cambiar contraseña" valida en el cliente (campos completos, largo
  mínimo, nueva = repetida) y llama al server action
  `changePassword` (`lib/data/customer.ts`), que primero verifica la
  "contraseña actual" haciendo un login real contra el provider
  `emailpass` de Medusa (el endpoint de update NO valida esa contraseña
  por sí solo — ver el comentario en `changePassword`) y recién ahí
  actualiza la contraseña. Si la actual está mal, o algo falla, se
  muestra el error con `toast.error`; si todo sale bien se cierra el
  formulario y se muestra el toast verde de éxito
  (`showSuccessToast`, en `common/components/success-toast`).
- "Notificaciones": no existe ningún campo de preferencia de
  notificaciones en el customer hoy — el checkbox es solo visual
  (estado local, no se guarda) hasta que exista dónde persistirlo.

*/

// Ancho del margen derecho de los separadores cortos — tocar este único
// valor cambia el largo de TODAS las líneas divisorias de la card. Llevan
// `ml-6` porque viven como hermanos directos de `Container` (que tiene
// `p-0`) — sin eso el divisor arrancaría 24px más a la izquierda que el
// texto de las secciones (Nombre/Dirección/Contraseña/Notificaciones),
// pegado al borde real de la card.
const DIVIDER_CLASS_STANDALONE = "h-px bg-neutral-200 ml-6 mr-10"

const PASSWORD_LABEL_CLASS = "text-xs text-neutral-500"

// Valor de "Editar Datos" a partir del customer (también se usa para
// descartar los cambios al cancelar).
const toProfileValues = (customer: B2BCustomer): ProfileFormValues => {
  const { countryCode, localNumber } = parsePhoneNumber(customer.phone)

  return {
    first_name: customer.first_name ?? "",
    last_name: customer.last_name ?? "",
    phone_country: countryCode,
    phone_local: localNumber,
  }
}

const EMPTY_PASSWORD_FORM: ChangePasswordFormValues = {
  current_password: "",
  password: "",
  repeat_password: "",
}

const ProfileCard = ({ customer }: { customer: B2BCustomer }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [receiveEmailNotifications, setReceiveEmailNotifications] =
    useState(true)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const profileDefaults = useMemo(() => toProfileValues(customer), [customer])

  const profileForm = useZodForm(profileSchema, {
    defaultValues: profileDefaults,
  })

  const passwordForm = useZodForm(changePasswordSchema, {
    defaultValues: EMPTY_PASSWORD_FORM,
  })

  const cancelEditing = () => {
    profileForm.reset(profileDefaults)
    setIsEditing(false)
  }

  const handleSave = profileForm.handleSubmit(async (values) => {
    const phone = values.phone_local
      ? `+${getDialCode(values.phone_country)}${values.phone_local}`
      : ""

    try {
      await updateCustomer({
        first_name: values.first_name,
        last_name: values.last_name,
        phone,
      })
    } catch (error) {
      // El Server Action corre en el servidor de Next.js: este error NUNCA
      // aparece en la pestaña Network del navegador (mismo caso que
      // `changePassword`, ver comentario en lib/data/customer.ts) — para
      // verlo hay que mirar la terminal donde corre `npm run dev`.
      console.error("[ProfileCard] falló updateCustomer:", error)
      toast.error("No se pudo actualizar tu perfil")
      return
    }

    profileForm.reset(values)
    setIsEditing(false)
    showSuccessToast("Su perfil ha sido actualizado")
  })

  const closePasswordForm = () => {
    setIsChangingPassword(false)
    passwordForm.reset(EMPTY_PASSWORD_FORM)
  }

  const handleSavePassword = passwordForm.handleSubmit(async (values) => {
    const result = await changePassword({
      currentPassword: values.current_password,
      newPassword: values.password,
    })

    if (result.error) {
      // El error típico es "contraseña actual incorrecta": se marca en ese
      // campo además del toast.
      passwordForm.setError("current_password", { message: result.error })
      toast.error(result.error)
      return
    }

    closePasswordForm()
    showSuccessToast("Contraseña actualizada correctamente")
  })

  const defaultAddress =
    customer.addresses?.find((a) => a.is_default_shipping) ||
    customer.addresses?.[0]

  const addressLines = defaultAddress
    ? [
        [defaultAddress.address_1, defaultAddress.address_2]
          .filter(Boolean)
          .join(" "),
        [defaultAddress.city, defaultAddress.province]
          .filter(Boolean)
          .join(", "),
      ].filter(Boolean)
    : []

  const companyId = customer.employee?.company?.id

  // Solo un employee admin (`employee.is_admin`, el mismo campo que ya usa
  // el resto del sitio para permisos — ver `account-nav`,
  // `approval-settings-card`, `employees-card`, checkout) puede agregar o
  // editar la dirección de la empresa. Un cliente normal la ve de solo
  // lectura acá; si no hay dirección todavía, no ve un link para
  // agregarla (eso vive en `/account/addresses`, que también quedó
  // bloqueado para no-admins — ver `AddressBook`).
  const isAdmin = customer.employee?.is_admin ?? false

  const Label = ({ children }: { children: ReactNode }) => (
    <Text size="large" className="font-semibold text-blue-900">
      {children}
    </Text>
  )

  return (
    <div className="h-fit">
      <div className="flex items-center gap-x-4 mb-4">
        <Text className="text-2xl font-bold text-neutral-950">
          Mis datos
        </Text>
        {!isEditing && (
          <button
            type="button"
            className="text-base font-bold hover:underline underline-offset-2"
            onClick={() => setIsEditing(true)}
          >
            Editar Datos
          </button>
        )}
      </div>

      <Container className="p-0 overflow-hidden">
        <form
          id="profile-form"
          noValidate
          onSubmit={handleSave}
          className="grid grid-cols-1 gap-6 p-6 small:grid-cols-2"
        >
          <div className="flex flex-col gap-y-2">
            <Label>Nombre</Label>
            {isEditing ? (
              <FormTextField
                control={profileForm.control}
                name="first_name"
                label="Nombre"
                autoComplete="given-name"
              />
            ) : (
              <Text size="large" className="text-neutral-950">
                {customer.first_name || "—"}
              </Text>
            )}
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Apellido</Label>
            {isEditing ? (
              <FormTextField
                control={profileForm.control}
                name="last_name"
                label="Apellido"
                autoComplete="family-name"
              />
            ) : (
              <Text size="large" className="text-neutral-950">
                {customer.last_name || "—"}
              </Text>
            )}
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Teléfono</Label>
            {isEditing ? (
              // El selector de país va como adornment dentro del mismo
              // TextField, así el borde/label/error son los del resto.
              <Controller
                control={profileForm.control}
                name="phone_country"
                render={({ field: country }) => (
                  <FormTextField
                    control={profileForm.control}
                    name="phone_local"
                    label="Teléfono"
                    type="tel"
                    autoComplete="tel-national"
                    slotProps={{
                      htmlInput: { inputMode: "numeric" },
                      inputLabel: { shrink: true },
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <PhoneCountrySelect
                              value={country.value}
                              onChange={country.onChange}
                            />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                )}
              />
            ) : (
              <Text size="large" className="text-neutral-950">
                {customer.phone || "—"}
              </Text>
            )}
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Email</Label>
            {isEditing ? (
              // Solo lectura: no se edita desde acá.
              <FormReadOnlyField label="Email" value={customer.email} />
            ) : (
              <Text size="large" className="text-neutral-950">
                {customer.email}
              </Text>
            )}
          </div>
          <div className="flex flex-col gap-y-2 small:col-span-2">
            <Label>ID del comercio</Label>
            {isEditing ? (
              <FormReadOnlyField label="ID del comercio" value={companyId} />
            ) : (
              <Text size="large" className="text-neutral-950">
                {companyId || "—"}
              </Text>
            )}
          </div>
        </form>

        {isEditing && (
          <div className="flex items-center justify-end gap-3 bg-neutral-50 p-6">
            <FormCancelButton
              onClick={cancelEditing}
              disabled={profileForm.formState.isSubmitting}
            >
              Cancelar
            </FormCancelButton>
            <FormSubmitButton
              form="profile-form"
              isPending={profileForm.formState.isSubmitting}
              pendingLabel="Guardando..."
            >
              Guardar cambios
            </FormSubmitButton>
          </div>
        )}
        <div className={DIVIDER_CLASS_STANDALONE} />

        <div className="flex flex-col gap-y-3 p-6">
          <Label>Dirección</Label>
          {addressLines.length > 0 ? (
            <div className="rounded-md border border-neutral-200 px-4 py-3 text-neutral-950 text-base">
              {addressLines.join(" ")}
            </div>
          ) : isAdmin ? (
            <Text size="large" className="text-neutral-500">
              Aún no registras una dirección.{" "}
              <LocalizedClientLink
                href="/account/addresses"
                className="text-blue-900 hover:underline"
              >
                Agregar dirección
              </LocalizedClientLink>
            </Text>
          ) : (
            <Text size="large" className="text-neutral-500">
              Aún no hay una dirección registrada. Solo un administrador de
              tu empresa puede agregarla.
            </Text>
          )}
        </div>
        <div className={DIVIDER_CLASS_STANDALONE} />

        <div className="flex flex-col gap-y-3 p-6">
          <Label>Contraseña</Label>

          {!isChangingPassword ? (
            // La caja de contraseña y el link "Cambiar contraseña" van
            // siempre en la misma fila (a pedido explícito), incluso en
            // mobile: por eso no hay un toggle flex-col/small:flex-row acá
            // como en el resto de la card. El campo usa flex-1 + min-w-0
            // para poder achicarse en pantallas angostas sin empujar el
            // botón a una segunda línea, y el botón usa shrink-0 para
            // no perder su ancho de texto.
            <div className="flex flex-row items-center justify-between gap-5">
              <div className="flex flex-col gap-y-1.5 flex-1 min-w-0 max-w-xs">
                <label htmlFor="password_display" className={PASSWORD_LABEL_CLASS}>
                  Contraseña
                </label>
                {/*
                  El sitio legacy (sonrie.youorder.me) muestra este campo con
                  las clases reales `MuiInputBase-input MuiOutlinedInput-input
                  Mui-disabled` (confirmado inspeccionando sus chunks JS, igual
                  que se hizo para identificar el DatePicker) — o sea que ahí
                  NO es una cajita Tailwind imitando el look, es un
                  `OutlinedInput` real de Material UI en estado disabled. Para
                  que coincida a nivel de píxel se reemplaza acá por el mismo
                  componente real, reusando `muiTheme` (el mismo tema del
                  DatePicker en `document-filters`) solo para este campo — el
                  label de arriba sigue siendo el nuestro (Tailwind), no el
                  label flotante de MUI, porque así se ve en el legacy.
                */}
                <ThemeProvider theme={muiTheme}>
                  <OutlinedInput
                    id="password_display"
                    type="password"
                    value="12345678"
                    disabled
                    fullWidth
                    inputProps={{ readOnly: true, "aria-label": "Contraseña" }}
                    sx={{
                      height: 44, // = h-11, para alinear con el resto de las cajas del form
                      backgroundColor: "#fff",
                      fontSize: "0.875rem", // text-sm
                      "& .MuiOutlinedInput-input": {
                        paddingTop: 0,
                        paddingBottom: 0,
                        paddingLeft: "12px", // = pl-3
                      },
                    }}
                  />
                </ThemeProvider>
              </div>
              <button
                type="button"
                className="text-base font-medium text-neutral-950 hover:underline underline-offset-2 whitespace-nowrap shrink-0"
                onClick={() => setIsChangingPassword(true)}
              >
                Cambiar contraseña
              </button>
            </div>
          ) : (
            <form
              noValidate
              onSubmit={handleSavePassword}
              className="flex flex-col gap-y-4"
            >
              {(
                [
                  ["current_password", "Contraseña actual", "current-password"],
                  ["password", "Ingresar nueva contraseña", "new-password"],
                  ["repeat_password", "Repetir contraseña", "new-password"],
                ] as const
              ).map(([name, label, autoComplete]) => (
                <div key={name} className="w-full small:max-w-xs">
                  <FormPasswordField
                    control={passwordForm.control}
                    name={name}
                    label={label}
                    autoComplete={autoComplete}
                  />
                </div>
              ))}

              <div className="flex items-center justify-end gap-4">
                <button
                  type="button"
                  className="text-base font-medium text-neutral-950 hover:underline underline-offset-2"
                  onClick={closePasswordForm}
                >
                  Cancelar
                </button>
                <FormSubmitButton
                  isPending={passwordForm.formState.isSubmitting}
                  pendingLabel="Guardando..."
                >
                  Guardar contraseña
                </FormSubmitButton>
              </div>
            </form>
          )}
        </div>
        <div className={DIVIDER_CLASS_STANDALONE} />

        <div className="flex flex-col gap-y-3 p-6">
          <Label>Notificaciones</Label>
          {/*
            TODO: no existe todavía un campo de preferencia de
            notificaciones en el customer — este checkbox es solo visual
            (no persiste) hasta que se defina dónde guardarlo (metadata
            del customer, o un módulo propio).
          */}
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="email-notifications"
              checked={receiveEmailNotifications}
              onCheckedChange={(checked) =>
                setReceiveEmailNotifications(Boolean(checked))
              }
            />
            <label
              htmlFor="email-notifications"
              className="text-base text-neutral-950 cursor-pointer"
            >
              Quiero recibir notificaciones via email
            </label>
          </div>
        </div>
      </Container>
    </div>
  )
}

export default ProfileCard
