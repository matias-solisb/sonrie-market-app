import {
  IAuthModuleService,
  MedusaContainer,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
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
