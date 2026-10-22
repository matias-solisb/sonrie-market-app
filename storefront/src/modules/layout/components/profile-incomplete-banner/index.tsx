"use client"

import { dismissProfileBanner } from "@/lib/data/customer"
import {
  getMissingProfileFields,
  joinLabels,
} from "@/lib/util/profile-completion"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { InformationCircleSolid, XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { usePathname } from "next/navigation"
import { useState } from "react"

/*

Franja bajo el header cuando al colaborador le faltan datos del perfil (regla
en lib/util/profile-completion.ts).

- Dato editable (teléfono): "Te falta registrar tu teléfono. Completar ahora"
  → /account/profile.
- Dato no editable (correo): pide contactar al administrador.
- No se muestra en /account/profile: ahí ya está el formulario.
- La ✕ la oculta durante la sesión. Se guarda en una cookie (cookies.ts) y
  el layout la lee en el servidor (`initiallyDismissed`): la franja viene en
  el HTML inicial y no empuja el contenido al aparecer. Vuelve en el
  siguiente login mientras el dato siga faltando.

Colores de la paleta del flujo (azul/gris), no rojo: es un aviso, no un error.

*/
const ProfileIncompleteBanner = ({
  customer,
  initiallyDismissed,
}: {
  customer: HttpTypes.StoreCustomer
  initiallyDismissed: boolean
}) => {
  const pathname = usePathname()
  const [dismissed, setDismissed] = useState(initiallyDismissed)

  const missing = getMissingProfileFields(customer)

  if (!missing.length || dismissed || pathname?.endsWith("/account/profile")) {
    return null
  }

  const editable = missing.filter((f) => f.editable)
  const readOnly = missing.filter((f) => !f.editable)

  const dismiss = () => {
    setDismissed(true)
    // Si falla, solo se oculta en esta vista: vuelve al recargar.
    dismissProfileBanner().catch(() => undefined)
  }

  return (
    <div
      className="border-b border-blue-100 bg-blue-50 text-blue-900"
      role="status"
      data-testid="profile-incomplete-banner"
      data-value={missing.map((f) => f.field).join(",")}
    >
      <div className="content-container flex items-start gap-x-3 py-3 text-sm">
        <InformationCircleSolid className="mt-0.5 shrink-0 text-blue-700" />

        <div className="flex flex-1 flex-col gap-y-1 small:flex-row small:flex-wrap small:gap-x-4">
          {editable.length > 0 && (
            <span>
              Te falta registrar tu <b>{joinLabels(editable)}</b>.{" "}
              <LocalizedClientLink
                href="/account/profile"
                className="font-semibold underline underline-offset-2 hover:text-blue-700"
                data-testid="profile-incomplete-banner-link"
              >
                Completar ahora
              </LocalizedClientLink>
            </span>
          )}
          {readOnly.length > 0 && (
            <span>
              Tu cuenta no tiene <b>{joinLabels(readOnly)}</b> registrado: pide a
              tu administrador que lo agregue. Sin él no podrás recuperar tu
              contraseña.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar aviso"
          className="shrink-0 rounded p-0.5 text-blue-700 hover:bg-blue-100"
          data-testid="profile-incomplete-banner-close"
        >
          <XMark />
        </button>
      </div>
    </div>
  )
}

export default ProfileIncompleteBanner
