/*

Utilidades de RUT chileno (rut-auth, paso 1).

Formato normalizado: cuerpo sin puntos ni ceros a la izquierda, guion y DV
en mayúscula → "12345678-5", "10000013-K". Es el `entity_id` de la
identidad del provider `rut`, así que dos formas de escribir el mismo RUT
("12.345.678-5", "123456785", " 12345678-5 ") terminan en la misma cuenta.

Reglas de validación:
- Cuerpo de 6 a 8 dígitos (sin contar ceros a la izquierda). Cubre a
  cualquier persona natural; descarta basura corta y números de 9 dígitos.
- DV calculado con módulo 11 (factores 2..7 desde la derecha;
  11 → "0", 10 → "K").

Seguridad: los últimos 4 dígitos del cuerpo son la clave inicial
(`initialPasswordFromRut`). Por eso `maskRut` NUNCA los deja visibles: en
los logs solo aparecen los 2 primeros dígitos y el DV.

*/

const BODY_REGEX = /^[1-9]\d{5,7}$/;

/** DV (módulo 11) de un cuerpo de RUT con solo dígitos. */
export const computeRutDv = (body: string): string => {
  let sum = 0;
  let factor = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const rest = 11 - (sum % 11);

  if (rest === 11) {
    return "0";
  }
  if (rest === 10) {
    return "K";
  }
  return String(rest);
};

/**
 * Devuelve el RUT normalizado ("12345678-5") o `null` si no es un RUT válido
 * (formato incorrecto o DV que no calza).
 */
export const normalizeRut = (input: unknown): string | null => {
  if (typeof input !== "string") {
    return null;
  }

  // Se aceptan puntos, espacios y UN guion opcional antes del DV.
  const compact = input.replace(/[.\s]/g, "").toUpperCase();
  const match = /^(\d+)-?([\dK])$/.exec(compact);

  if (!match) {
    return null;
  }

  const body = match[1].replace(/^0+/, "");
  const dv = match[2];

  if (!BODY_REGEX.test(body)) {
    return null;
  }

  if (computeRutDv(body) !== dv) {
    return null;
  }

  return `${body}-${dv}`;
};

export const isValidRut = (input: unknown): boolean =>
  normalizeRut(input) !== null;

/**
 * Clave inicial del colaborador: los últimos 4 dígitos del cuerpo, sin el
 * DV. La genera la plataforma en el alta; nunca viaja en archivos.
 */
export const initialPasswordFromRut = (rut: string): string => {
  const normalized = normalizeRut(rut);

  if (!normalized) {
    throw new Error("RUT inválido: no se puede derivar la clave inicial.");
  }

  const body = normalized.split("-")[0];
  return body.slice(-4);
};

/**
 * RUT enmascarado para logs: "12******-5". Deja ver los 2 primeros dígitos y
 * el DV, suficiente para orientarse sin exponer el RUT ni la clave inicial.
 * Un valor que no es RUT válido se reemplaza entero.
 */
export const maskRut = (rut: unknown): string => {
  const normalized = normalizeRut(rut);

  if (!normalized) {
    return "[rut-invalido]";
  }

  const [body, dv] = normalized.split("-");
  return `${body.slice(0, 2)}${"*".repeat(body.length - 2)}-${dv}`;
};
