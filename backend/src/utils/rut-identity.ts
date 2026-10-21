import {
  IAuthModuleService,
  MedusaContainer,
} from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { RUT_AUTH_PROVIDER_ID } from "../modules/rut-auth/config";
import { RutProviderMetadata } from "../modules/rut-auth/types";

/*

Identidad `rut` de una auth identity (la de la sesión: `auth_context.
auth_identity_id`). Devuelve el RUT normalizado y el estado guardado por el
provider, o null si esa auth identity no tiene provider `rut`.

Se usa fuera del provider (rutas y middlewares), que sí pueden resolver el
Auth Module pero no tienen el RUT a mano: el JWT trae el id del customer y
de la auth identity, no el RUT.

El hash nunca sale de acá: se descarta antes de devolver el estado.

*/
export type RutIdentity = {
  rut: string;
  state: Omit<RutProviderMetadata, "password_hash">;
};

export const getRutIdentity = async (
  container: MedusaContainer,
  authIdentityId: string | undefined
): Promise<RutIdentity | null> => {
  if (!authIdentityId) {
    return null;
  }

  const authModule = container.resolve<IAuthModuleService>(Modules.AUTH);
  const [providerIdentity] = await authModule.listProviderIdentities({
    auth_identity_id: authIdentityId,
    provider: RUT_AUTH_PROVIDER_ID,
  });

  if (!providerIdentity) {
    return null;
  }

  const { password_hash: _hash, ...state } = (providerIdentity.provider_metadata ??
    {}) as RutProviderMetadata;

  return { rut: providerIdentity.entity_id, state };
};

/**
 * Identidad `rut` del customer (para el Admin: el widget y la ruta de
 * habilitación parten del id del customer). El vínculo customer ↔ identidad
 * vive en `auth_identity.app_metadata.customer_id`, sin module link, así que
 * se busca con SQL.
 */
export const getRutIdentityByCustomer = async (
  container: MedusaContainer,
  customerId: string
): Promise<RutIdentity | null> => {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const { rows } = await pg.raw(
    `select pi.entity_id, pi.provider_metadata
       from provider_identity pi
       join auth_identity ai on ai.id = pi.auth_identity_id
      where pi.provider = ?
        and pi.deleted_at is null
        and ai.deleted_at is null
        and ai.app_metadata->>'customer_id' = ?
      limit 1`,
    [RUT_AUTH_PROVIDER_ID, customerId]
  );

  if (!rows.length) {
    return null;
  }

  const { password_hash: _hash, ...state } = (rows[0].provider_metadata ??
    {}) as RutProviderMetadata;

  return { rut: rows[0].entity_id, state };
};

/**
 * Customer de un RUT normalizado (para la auditoría del reset: el token del
 * correo trae el RUT, no el customer). null si no hay identidad o customer.
 */
export const getCustomerIdByRut = async (
  container: MedusaContainer,
  rut: string
): Promise<string | null> => {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const { rows } = await pg.raw(
    `select ai.app_metadata->>'customer_id' as customer_id
       from provider_identity pi
       join auth_identity ai on ai.id = pi.auth_identity_id
      where pi.provider = ?
        and pi.entity_id = ?
        and pi.deleted_at is null
        and ai.deleted_at is null
      limit 1`,
    [RUT_AUTH_PROVIDER_ID, rut]
  );

  return rows[0]?.customer_id ?? null;
};
