import type { HttpTypes } from "@medusajs/types"

/*

Perfil completo del colaborador: ÚNICA regla.

La usan la franja de aviso del layout (ProfileIncompleteBanner), el punto del
menú de usuario (AccountMenu) y el resumen de /account (Overview). Para exigir
otro dato, agrégalo a REQUIRED_PROFILE_FIELDS y a FIELD_INFO; nada más.

`editable`: si el colaborador lo puede completar él mismo en
/account/profile. El correo es de solo lectura (lo registra la plataforma en
el alta, `alta-colaborador`), así que si falta el aviso le pide contactar a
su administrador en vez de mandarlo al perfil.

Reemplaza a `getProfileCompletion` del B2B Starter, que exigía una dirección
de facturación: en Sonríe Market no se factura ni se despacha (se paga con el
cupo y se retira en un site), así que nadie llegaba al 100 %.

*/

export const REQUIRED_PROFILE_FIELDS = ["email", "phone"] as const

export type RequiredProfileField = (typeof REQUIRED_PROFILE_FIELDS)[number]

const FIELD_INFO: Record<RequiredProfileField, { label: string; editable: boolean }> = {
  email: { label: "correo", editable: false },
  phone: { label: "teléfono", editable: true },
}

export type MissingProfileField = {
  field: RequiredProfileField
  /** En minúsculas, para usar dentro de una frase: "tu teléfono". */
  label: string
  editable: boolean
}

type ProfileData =
  | { [K in RequiredProfileField]?: string | null }
  | null
  | undefined

/** Datos requeridos que le faltan al colaborador, en el orden de REQUIRED_PROFILE_FIELDS. */
export const getMissingProfileFields = (customer: ProfileData): MissingProfileField[] => {
  if (!customer) {
    return []
  }

  return REQUIRED_PROFILE_FIELDS.filter((field) => !customer[field]?.trim()).map(
    (field) => ({ field, ...FIELD_INFO[field] })
  )
}

/** "teléfono" · "correo y teléfono" · "a, b y c". */
export const joinLabels = (fields: MissingProfileField[]) => {
  const labels = fields.map((f) => f.label)

  if (labels.length <= 1) {
    return labels[0] ?? ""
  }

  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`
}
