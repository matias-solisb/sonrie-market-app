import { LOCKOUT, RUT_AUTH_PROVIDER_ID } from "./config";
import { RutProviderMetadata } from "./types";

/*

Contador de intentos y bloqueo (rut-auth, paso 7).

Cada intento de login se CUENTA ANTES de verificar la clave, con una sola
sentencia SQL sobre la fila de `provider_identity`:

  1. Toma la fila con FOR UPDATE: dos intentos simultáneos sobre el mismo RUT
     se ejecutan uno después del otro.
  2. Si ya estaba bloqueada (locked_until en el futuro), no cambia nada y el
     intento se rechaza sin mirar la clave.
  3. Si no, suma 1 a failed_attempts (partiendo de 0 si el bloqueo anterior
     ya venció) y, al llegar a LOCKOUT.maxFailedAttempts, fija locked_until.

Así 20 intentos en paralelo no pasan del límite: solo los primeros N quedan
autorizados a verificar la clave. Un login correcto reinicia el contador
(`resetAttempts`). Contar después de verificar no sirve: todos los intentos
simultáneos leerían "N-1 fallos" y verificarían la clave.

Se usa la conexión de PostgreSQL que Medusa le pasa al provider
(`__pg_connection__`) porque el AuthIdentityProviderService solo permite leer
y reescribir la metadata completa, sin atomicidad.

Las fechas se guardan como texto ISO 8601 en UTC (mismo formato que
`new Date().toISOString()`), igual que el resto de provider_metadata.

*/

type Knex = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows: any[] }>;
};

export type AttemptResult =
  | { exists: false }
  | {
      exists: true;
      /** Ya estaba bloqueada: no se verifica la clave. */
      locked: boolean;
      metadata: RutProviderMetadata;
    };

const ISO_NOW_PLUS = `to_jsonb(to_char((now() + make_interval(mins => ?)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))`;

const IS_LOCKED = (m: string) =>
  `(${m}->>'locked_until' is not null and (${m}->>'locked_until')::timestamptz > now())`;

const IS_EXPIRED_LOCK = (m: string) =>
  `(${m}->>'locked_until' is not null and (${m}->>'locked_until')::timestamptz <= now())`;

export const registerAttempt = async (
  pg: Knex,
  rut: string
): Promise<AttemptResult> => {
  const base = `(case when ${IS_EXPIRED_LOCK("prev.m")} then 0
                      else coalesce((prev.m->>'failed_attempts')::int, 0) end)`;

  const { rows } = await pg.raw(
    `with prev as (
       select id, provider_metadata as m
         from provider_identity
        where provider = ? and entity_id = ? and deleted_at is null
        for update
     )
     update provider_identity p
        set provider_metadata = case
              when ${IS_LOCKED("prev.m")} then prev.m
              else prev.m || jsonb_build_object(
                'failed_attempts', ${base} + 1,
                'locked_until', case when ${base} + 1 >= ?
                                     then ${ISO_NOW_PLUS}
                                     else 'null'::jsonb end)
            end,
            updated_at = now()
       from prev
      where p.id = prev.id
     returning ${IS_LOCKED("prev.m")} as was_locked, p.provider_metadata`,
    [
      RUT_AUTH_PROVIDER_ID,
      rut,
      LOCKOUT.maxFailedAttempts,
      LOCKOUT.lockMinutes,
    ]
  );

  if (!rows.length) {
    return { exists: false };
  }

  return {
    exists: true,
    locked: rows[0].was_locked === true,
    metadata: rows[0].provider_metadata as RutProviderMetadata,
  };
};

/** Login correcto: contador a 0 y sin bloqueo. */
export const resetAttempts = async (pg: Knex, rut: string) => {
  await pg.raw(
    `update provider_identity
        set provider_metadata = provider_metadata ||
              jsonb_build_object('failed_attempts', 0, 'locked_until', null),
            updated_at = now()
      where provider = ? and entity_id = ? and deleted_at is null`,
    [RUT_AUTH_PROVIDER_ID, rut]
  );
};
