/*

Política de clave nueva para el storefront (rut-auth, paso 8).

COPIA de backend/src/modules/rut-auth/password-policy.ts (y de
PASSWORD_POLICY en backend/src/modules/rut-auth/config.ts). Si cambia una
regla allá, cámbiala acá. El backend es el que decide: esta copia existe
porque el enlace de recuperación es de un solo uso y el core de Medusa lo
consume ANTES de revisar la clave. Si la clave nueva no cumple, el
colaborador perdería el enlace; revisándola acá primero, puede corregirla.

*/

export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
} as const

const RUT_SEGMENT_LENGTH = 4

const rutSegments = (rut: string): string[] => {
  const body = rut.split("-")[0]
  const segments: string[] = []

  for (let i = 0; i + RUT_SEGMENT_LENGTH <= body.length; i++) {
    segments.push(body.slice(i, i + RUT_SEGMENT_LENGTH))
  }

  return segments
}

/**
 * Devuelve el motivo del rechazo o `null` si la clave cumple la política.
 * `rut` debe venir normalizado ("12345678-5").
 */
export const checkNewPassword = (
  rut: string,
  password: unknown
): string | null => {
  if (
    typeof password !== "string" ||
    password.length < PASSWORD_POLICY.minLength
  ) {
    return `La clave debe tener al menos ${PASSWORD_POLICY.minLength} caracteres.`
  }

  if (password.length > PASSWORD_POLICY.maxLength) {
    return `La clave puede tener como máximo ${PASSWORD_POLICY.maxLength} caracteres.`
  }

  const compact = password.replace(/[.\-\s]/g, "")

  if (rutSegments(rut).some((segment) => compact.includes(segment))) {
    return "La clave no puede contener números de tu RUT."
  }

  return null
}
