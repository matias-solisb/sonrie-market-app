import { RUT_AUTH_PROVIDER_ID } from "./config";
import { RutProviderMetadata } from "./types";

/*

Habilitar / deshabilitar la cuenta de un colaborador (rut-auth, paso 9).

Un solo UPDATE sobre `provider_identity`, que cambia SOLO `enabled` y su
trazabilidad (`enabled_changed_at`, `enabled_changed_by`) con `||` sobre el
jsonb: no lee y reescribe la metadata completa, así no pisa un contador de
intentos que se esté actualizando al mismo tiempo (lockout.ts).

Devuelve la metadata anterior (para compensar en el workflow) y la nueva, o
null si el RUT no tiene identidad `rut`.

*/

type Knex = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows: any[] }>;
};

export type SetEnabledResult = {
  previous: Pick<
    RutProviderMetadata,
    "enabled" | "enabled_changed_at" | "enabled_changed_by"
  >;
  current: Omit<RutProviderMetadata, "password_hash">;
};

export const setEnabled = async (
  pg: Knex,
  rut: string,
  enabled: boolean,
  changedBy: string | null,
  changedAt: string | null = new Date().toISOString()
): Promise<SetEnabledResult | null> => {
  const { rows } = await pg.raw(
    `with prev as (
       select id, provider_metadata as m
         from provider_identity
        where provider = ? and entity_id = ? and deleted_at is null
        for update
     )
     update provider_identity p
        set provider_metadata = prev.m || jsonb_build_object(
              'enabled', ?::boolean,
              'enabled_changed_at', ?::text,
              'enabled_changed_by', ?::text),
            updated_at = now()
       from prev
      where p.id = prev.id
     returning prev.m as previous, p.provider_metadata as current`,
    [RUT_AUTH_PROVIDER_ID, rut, enabled, changedAt, changedBy]
  );

  if (!rows.length) {
    return null;
  }

  const strip = ({ password_hash: _h, ...rest }: RutProviderMetadata) => rest;
  const previous = rows[0].previous as RutProviderMetadata;

  return {
    previous: {
      // Identidades anteriores al paso 9 pueden no tener el campo: habilitadas.
      enabled: previous.enabled !== false,
      enabled_changed_at: previous.enabled_changed_at ?? null,
      enabled_changed_by: previous.enabled_changed_by ?? null,
    },
    current: strip(rows[0].current as RutProviderMetadata),
  };
};
