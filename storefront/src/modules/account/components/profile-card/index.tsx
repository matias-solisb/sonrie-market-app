"use client"

import { changePassword, updateCustomer } from "@/lib/data/customer"
import Button from "@/modules/common/components/button"
import Input from "@/modules/common/components/input"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { showSuccessToast } from "@/modules/common/components/success-toast"
import Eye from "@/modules/common/icons/eye"
import EyeOff from "@/modules/common/icons/eye-off"
import { muiTheme } from "@/lib/mui/theme"
import { B2BCustomer } from "@/types/global"
import { HttpTypes } from "@medusajs/types"
import { Checkbox, Container, Text, clx, toast } from "@medusajs/ui"
import OutlinedInput from "@mui/material/OutlinedInput"
import { ThemeProvider } from "@mui/material/styles"
import { useState, type ReactNode } from "react"

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

Los separadores entre secciones (Dirección/Contraseña/Notificaciones, y el
bloque de datos de arriba) NO son un `border-b` de ancho completo — son un
div de 1px propio (`h-px bg-neutral-200`) con margen derecho (`mr-10`)
para que la línea quede corta y no toque el borde derecho del recuadro,
tal como pide la referencia. Se pone como último hijo de cada sección (no
como borde del contenedor) para que además participe de la misma
animación de colapso que el resto del contenido de esa sección.

- "Cambiar contraseña" ahora guarda de verdad: valida en el cliente
  (campos completos, nueva = repetida) y llama al server action
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
// valor cambia el largo de TODAS las líneas divisorias de la card.
//
// Hay dos variantes porque el punto de partida (izquierda) depende de si
// el divisor vive DENTRO de un contenedor que ya tiene `p-6` (grids de
// "Nombre/Email/..." — ahí el padding del contenedor ya lo alinea con el
// texto, no hace falta márgen izquierdo) o si vive como hermano directo de
// `Container` (que tiene `p-0`) — ahí sin `ml-6` el divisor arrancaría 24px
// más a la izquierda que el texto de las secciones (Dirección/Contraseña/
// Notificaciones), pegado al borde real de la card.
const DIVIDER_CLASS = "h-px bg-neutral-200 mr-10"
const DIVIDER_CLASS_STANDALONE = "h-px bg-neutral-200 ml-6 mr-10"

// Campo de Contraseña con su propio estilo — mismo patrón "label arriba +
// cajita abajo" que ya usa el selector de Dirección en el carro
// (`cart/components/delivery-options/index.tsx`: label `text-xs
// text-neutral-500`, separados por `gap-y-1.5`, caja `rounded-md border
// border-gray-200 bg-white h-11`). No usa el `Input` compartido de
// `common/components/input` porque ese trae `rounded-full` fijo (no se
// puede pisar solo con className, misma prioridad en el CSS generado por
// Tailwind) y además dibuja el label flotando encima del borde, que fue
// justo lo que se veía mal acá — este patrón es más simple: el label
// nunca se mueve, siempre está arriba de la caja.
const PASSWORD_LABEL_CLASS = "text-xs text-neutral-500"
const PASSWORD_INPUT_CLASS =
  "w-full appearance-none rounded-md border border-gray-200 bg-white h-11 pl-3 pr-9 text-sm text-neutral-950 outline-none hover:border-gray-300"

const PasswordField = ({
  label,
  name,
  value,
  onChange,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
}) => {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex flex-col gap-y-1.5 w-full small:max-w-xs">
      <label htmlFor={name} className={PASSWORD_LABEL_CLASS}>
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={PASSWORD_INPUT_CLASS}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"
        >
          {visible ? <Eye size="18" /> : <EyeOff size="18" />}
        </button>
      </div>
    </div>
  )
}

const ProfileCard = ({ customer }: { customer: B2BCustomer }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [receiveEmailNotifications, setReceiveEmailNotifications] =
    useState(true)

  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    repeat: "",
  })

  const { first_name, last_name, phone } = customer

  const [customerData, setCustomerData] = useState({
    first_name,
    last_name,
    phone,
  } as HttpTypes.StoreUpdateCustomer)

  const handleSave = async () => {
    setIsSaving(true)
    await updateCustomer(customerData).catch(() => {
      toast.error("Error updating customer")
    })
    setIsSaving(false)
    setIsEditing(false)

    toast.success("Customer updated")
  }

  const closePasswordForm = () => {
    setIsChangingPassword(false)
    setPasswordForm({ current: "", next: "", repeat: "" })
  }

  const handleSavePassword = async () => {
    if (!passwordForm.current || !passwordForm.next || !passwordForm.repeat) {
      toast.error("Completa los tres campos.")
      return
    }

    if (passwordForm.next !== passwordForm.repeat) {
      toast.error("La nueva contraseña y su repetición no coinciden.")
      return
    }

    setIsSavingPassword(true)

    const result = await changePassword({
      currentPassword: passwordForm.current,
      newPassword: passwordForm.next,
    })

    setIsSavingPassword(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    closePasswordForm()
    showSuccessToast("Contraseña actualizada correctamente")
  }

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
          className={clx(
            "grid grid-cols-1 small:grid-cols-2 gap-6 overflow-hidden transition-all duration-300 ease-in-out",
            {
              "max-h-[640px] small:max-h-[460px] opacity-100 p-6": isEditing,
              "max-h-0 opacity-0": !isEditing,
            }
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleSave()
            }
          }}
        >
          <div className="flex flex-col gap-y-2">
            <Label>Nombre</Label>
            <Input
              label="First Name"
              name="first_name"
              value={customerData.first_name || ""}
              onChange={(e) =>
                setCustomerData({
                  ...customerData,
                  first_name: e.target.value,
                })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Apellido</Label>
            <Input
              label="Last Name"
              name="last_name"
              value={customerData.last_name || ""}
              onChange={(e) =>
                setCustomerData({
                  ...customerData,
                  last_name: e.target.value,
                })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Teléfono</Label>
            <Input
              label="Phone"
              name="phone"
              value={customerData.phone || ""}
              onChange={(e) =>
                setCustomerData({ ...customerData, phone: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Email</Label>
            <Text className="text-neutral-950">{customer.email}</Text>
          </div>
          <div className="flex flex-col gap-y-2 small:col-span-2">
            <Label>ID del comercio</Label>
            <Text className="text-neutral-950">{companyId || "—"}</Text>
          </div>
          <div className="small:col-span-2">
            <div className={DIVIDER_CLASS} />
          </div>
        </form>

        <div
          className={clx(
            "grid grid-cols-1 small:grid-cols-2 gap-x-10 gap-y-6 transition-all duration-300 ease-in-out",
            {
              "opacity-0 max-h-0": isEditing,
              "opacity-100 max-h-[600px] small:max-h-[380px] p-6": !isEditing,
            }
          )}
        >
          <div className="flex flex-col gap-y-1">
            <Label>Nombre</Label>
            <Text size="large" className="text-neutral-950">
              {[customer.first_name, customer.last_name]
                .filter(Boolean)
                .join(" ") || "—"}
            </Text>
          </div>
          <div className="hidden small:block" />
          <div className="flex flex-col gap-y-1">
            <Label>Teléfono</Label>
            <Text size="large" className="text-neutral-950">{customer.phone || "—"}</Text>
          </div>
          <div className="flex flex-col gap-y-1">
            <Label>Email</Label>
            <Text size="large" className="text-neutral-950">{customer.email}</Text>
          </div>
          <div className="flex flex-col gap-y-1">
            <Label>ID del comercio</Label>
            <Text size="large" className="text-neutral-950">{companyId || "—"}</Text>
          </div>
          <div className="hidden small:block" />
          <div className="small:col-span-2">
            <div className={DIVIDER_CLASS} />
          </div>
        </div>

        {isEditing && (
          <>
            <div className="flex items-center justify-end gap-3 bg-neutral-50 p-6">
              <Button
                variant="secondary"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
                Save
              </Button>
            </div>
            <div className={DIVIDER_CLASS_STANDALONE} />
          </>
        )}

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
                  label flotante de MUI, para mantener el patrón "label
                  arriba + caja abajo" que ya se definió para el resto del
                  formulario de contraseña.
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
            <div className="flex flex-col gap-y-4">
              <PasswordField
                label="Contraseña actual"
                name="current_password"
                value={passwordForm.current}
                onChange={(value) =>
                  setPasswordForm({ ...passwordForm, current: value })
                }
              />
              <PasswordField
                label="Ingresar nueva contraseña"
                name="new_password"
                value={passwordForm.next}
                onChange={(value) =>
                  setPasswordForm({ ...passwordForm, next: value })
                }
              />
              <PasswordField
                label="Repetir contraseña"
                name="repeat_password"
                value={passwordForm.repeat}
                onChange={(value) =>
                  setPasswordForm({ ...passwordForm, repeat: value })
                }
              />

              <div className="flex items-center justify-end gap-4">
                <button
                  type="button"
                  className="text-base font-medium text-neutral-950 hover:underline underline-offset-2"
                  onClick={closePasswordForm}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="rounded-md bg-blue-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleSavePassword}
                  disabled={isSavingPassword}
                >
                  {isSavingPassword ? "Guardando..." : "Guardar contraseña"}
                </button>
              </div>
            </div>
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
