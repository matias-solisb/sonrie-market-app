import { createHmac } from "node:crypto"
import type { Logger } from "@medusajs/framework/types"

/*

Auditoría de acceso de colaboradores (rut-auth, paso 10).

Cada evento es UNA línea JSON en el log de la aplicación, con
`evento: "auth.<algo>"`, misma convención que `pickup_scheduling.cambio`. En
Azure, Container Apps manda la salida estándar a Log Analytics (retención
≥ 12 meses en PRD); ahí se filtra con `parse_json`. No hay tabla en la base:
la decisión del paso 10 fue "solo logs".

Qué identifica al colaborador (decisión del paso 10, por minimización de
datos — Ley 19.628 / 21.719):

- Si la cuenta existe: `customer_id`. No es un dato personal por sí solo y se
  cruza con el panel o la base.
- Si no hay customer_id (RUT que no existe, o un evento anterior a saber si
  existe): `rut_ref`, un HMAC-SHA256 del RUT normalizado con
  AUDIT_HASH_SECRET. Permite ver que el mismo RUT se probó muchas veces sin
  guardar el RUT. Un hash sin clave no serviría: hay pocos RUTs posibles y se
  calculan todos en segundos.
- NUNCA: RUT en claro, correo, clave ni token.

Para buscar los eventos de un RUT puntual: calcular su rut_ref con
`npx medusa exec ./src/scripts/rut-ref.ts <rut>` (mismo secreto del ambiente).

IP: `ip` y `ip_cadena` (ver `clientIp`). Sin user agent (decisión del paso 10).

*/

export type AuthAuditEvent =
  | "auth.login_ok"
  | "auth.login_fallido"
  | "auth.bloqueo"
  | "auth.cambio_clave"
  | "auth.cambio_clave_fallido"
  | "auth.reset_solicitado"
  | "auth.reset_enviado"
  | "auth.reset_no_enviado"
  | "auth.habilitar"
  | "auth.deshabilitar"

type Headers = Record<string, string | string[] | undefined> | undefined

const MIN_SECRET_LENGTH = 32
const RUT_REF_HEX_CHARS = 24 // 96 bits: sobra para correlacionar, no se puede invertir sin el secreto.
const MAX_CHAIN_LENGTH = 200

/** Secreto de desarrollo: solo fuera de producción y sin AUDIT_HASH_SECRET. */
const DEV_SECRET = "rut-auth-audit-dev-secret-no-usar-en-produccion"

let warnedMissingSecret = false

const auditSecret = (logger?: Logger): string | null => {
  const secret = process.env.AUDIT_HASH_SECRET

  if (secret && secret.length >= MIN_SECRET_LENGTH) {
    return secret
  }

  if (process.env.NODE_ENV !== "production") {
    return DEV_SECRET
  }

  // En producción, sin secreto válido no se calcula rut_ref (null en el
  // evento) en vez de usar uno conocido. El login sigue funcionando.
  if (!warnedMissingSecret) {
    warnedMissingSecret = true
    logger?.error(
      `rut-auth: AUDIT_HASH_SECRET no está definido o tiene menos de ${MIN_SECRET_LENGTH} caracteres; ` +
        "los eventos de auditoría van sin rut_ref."
    )
  }
  return null
}

/** Seudónimo del RUT (ya normalizado) para los logs. */
export const rutRef = (rut: string, logger?: Logger): string | null => {
  const secret = auditSecret(logger)

  if (!secret) {
    return null
  }

  return createHmac("sha256", secret)
    .update(rut)
    .digest("hex")
    .slice(0, RUT_REF_HEX_CHARS)
}

const headerValue = (headers: Headers, name: string): string | null => {
  const value = headers?.[name]
  const text = Array.isArray(value) ? value.join(",") : value
  return text?.trim() ? text.trim() : null
}

/**
 * IP del colaborador según `X-Forwarded-For`.
 *
 * - `ip_cadena`: el header completo (recortado), para revisar a mano.
 * - `ip`: la entrada que agregó el primer proxy de confianza. Cada proxy
 *   AGREGA al final, así que con AUDIT_TRUSTED_PROXY_HOPS = N se toma la
 *   N-ésima desde la derecha: lo que está más a la izquierda lo pudo escribir
 *   el propio cliente. Con 0 (por defecto, desarrollo) se toma la primera.
 *
 * ⚠️ En Azure hay que calibrar N en DEV (Front Door + ingress del storefront +
 * ingress del backend; el storefront reenvía el header en sus server
 * actions). Mientras no esté calibrado, `ip_cadena` es la referencia.
 */
export const clientIp = (
  headers: Headers
): { ip: string | null; ip_cadena: string | null } => {
  const chain = headerValue(headers, "x-forwarded-for")

  if (!chain) {
    return { ip: null, ip_cadena: null }
  }

  const entries = chain
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)

  const hops = Math.max(0, parseInt(process.env.AUDIT_TRUSTED_PROXY_HOPS ?? "0", 10) || 0)
  const ip =
    hops > 0
      ? entries[Math.max(0, entries.length - hops)] ?? null
      : entries[0] ?? null

  return { ip, ip_cadena: chain.slice(0, MAX_CHAIN_LENGTH) }
}

/**
 * Escribe un evento de auditoría. Nunca lanza: una falla al auditar no puede
 * romper un login.
 */
export const auditAuth = (
  logger: Logger | undefined,
  evento: AuthAuditEvent,
  fields: Record<string, unknown>
) => {
  try {
    const entry: Record<string, unknown> = {
      evento,
      fecha_hora: new Date().toISOString(),
    }

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        entry[key] = value
      }
    }

    logger?.info(JSON.stringify(entry))
  } catch {
    // Sin auditoría antes que sin login.
  }
}

/** Identificación según la regla de arriba: customer_id, o rut_ref si no hay. */
export const colaboradorRef = (
  customerId: string | null | undefined,
  rut: string | null | undefined,
  logger?: Logger
) =>
  customerId
    ? { customer_id: customerId }
    : { customer_id: null, rut_ref: rut ? rutRef(rut, logger) : null }
