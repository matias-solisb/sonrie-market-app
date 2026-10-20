import { PASSWORD_POLICY } from "./config";

/*

Política de clave nueva (rut-auth, paso 6). La aplica el provider en
`update`, así vale igual para el cambio de clave obligatorio, el cambio
desde el perfil y el reset por correo (paso 8).

⚠️ PROVISORIA, igual que config.ts: pendiente de revisión por Ciberseguridad.

Reglas:
1. Largo entre PASSWORD_POLICY.minLength y maxLength. El mínimo de 8 ya
   descarta la clave inicial (4 dígitos). El máximo evita que alguien mande
   una clave enorme para cargar el CPU con argon2.
2. No derivada del RUT: se rechaza si, ignorando puntos, guiones y espacios,
   contiene cualquier tramo de 4 dígitos seguidos del cuerpo del RUT. Eso
   cubre la clave inicial (los últimos 4), el cuerpo completo y el RUT con o
   sin formato. Puede rechazar alguna clave inocente que comparta 4 dígitos
   con el RUT; es el costo aceptado de una regla simple.

*/

const RUT_SEGMENT_LENGTH = 4;

const rutSegments = (rut: string): string[] => {
  const body = rut.split("-")[0];
  const segments: string[] = [];

  for (let i = 0; i + RUT_SEGMENT_LENGTH <= body.length; i++) {
    segments.push(body.slice(i, i + RUT_SEGMENT_LENGTH));
  }

  return segments;
};

/**
 * Devuelve el motivo del rechazo o `null` si la clave cumple la política.
 * `rut` debe venir normalizado ("12345678-5").
 */
export const checkNewPassword = (
  rut: string,
  password: unknown
): string | null => {
  if (typeof password !== "string" || password.length < PASSWORD_POLICY.minLength) {
    return `La clave debe tener al menos ${PASSWORD_POLICY.minLength} caracteres.`;
  }

  if (password.length > PASSWORD_POLICY.maxLength) {
    return `La clave puede tener como máximo ${PASSWORD_POLICY.maxLength} caracteres.`;
  }

  const compact = password.replace(/[.\-\s]/g, "");

  if (rutSegments(rut).some((segment) => compact.includes(segment))) {
    return "La clave no puede contener números de tu RUT.";
  }

  return null;
};
