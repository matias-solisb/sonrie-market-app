/*

Parámetros de seguridad de rut-auth. Todo lo que Ciberseguridad tiene que
revisar vive en este archivo, para cambiarlo en un solo lugar.

⚠️ PROVISORIOS — pendientes de revisión por Ciberseguridad Soprole
(compromiso del addendum: "parámetros definidos y revisados").

- argon2id: mínimo recomendado por OWASP (Password Storage Cheat Sheet):
  m = 19 MiB, t = 2, p = 1. Falta medir el tiempo de hash y la concurrencia
  en el contenedor real de Azure (pico del día 1 de cada mes); si sobra
  capacidad, conviene subir la memoria.
  Cambiarlos NO rompe los hashes existentes: cada hash guarda sus propios
  parámetros y se sigue verificando con ellos. Re-hashear con los valores
  nuevos en el próximo login exitoso queda pendiente para cuando cambien.

- Lockout: 5 intentos fallidos seguidos → 15 minutos bloqueado. Es el
  ejemplo de la especificación técnica (§4.1), no un valor de OWASP. Lo
  aplica lockout.ts. El storefront repite estos números en el mensaje de
  login (storefront/src/lib/data/customer.ts): si cambian, cambiarlos allá.

- Política de clave: entre 8 y 128 caracteres y sin números del RUT (ver
  password-policy.ts). El mínimo es el que tenía el alta con emailpass; el
  máximo evita claves enormes que carguen el CPU con argon2.

*/

export const RUT_AUTH_PROVIDER_ID = "rut";

export const ARGON2_PARAMS = {
  /** KiB. 19456 KiB = 19 MiB. */
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const LOCKOUT = {
  maxFailedAttempts: 5,
  lockMinutes: 15,
} as const;

export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
} as const;

/** Mensaje único para cualquier falla de login (sin enumeración de RUTs). */
export const INVALID_CREDENTIALS_MESSAGE = "RUT o clave incorrectos";

/**
 * Cuenta deshabilitada (paso 9). Solo se muestra cuando la clave es
 * CORRECTA: quien no la conoce recibe INVALID_CREDENTIALS_MESSAGE y no puede
 * distinguir una cuenta deshabilitada de un RUT inexistente.
 */
export const ACCOUNT_DISABLED_MESSAGE =
  "Tu cuenta está deshabilitada. Contacta a tu administrador.";
