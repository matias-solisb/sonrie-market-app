import { IAuthModuleService } from "@medusajs/framework/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { RUT_AUTH_PROVIDER_ID } from "../../../modules/rut-auth/config";
import { maskRut } from "../../../utils/rut";

/*

Crea la identidad de auth del colaborador con el provider `rut`.

El provider usa el RUT normalizado como entity_id, genera la clave inicial
(últimos 4 dígitos del RUT antes del DV) y deja must_change_password = true.
Este paso no maneja claves.

Falla si el RUT ya tiene identidad. Compensación: borra la identidad creada
si un paso posterior falla.

*/
export const registerRutIdentityStep = createStep(
  "register-rut-identity",
  async (input: { rut: string }, { container }) => {
    const authModule = container.resolve<IAuthModuleService>(Modules.AUTH);

    const { success, authIdentity, error } = await authModule.register(
      RUT_AUTH_PROVIDER_ID,
      { body: { rut: input.rut } }
    );

    if (!success || !authIdentity) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `No se pudo crear la identidad del RUT ${maskRut(input.rut)}: ${error ?? "error desconocido"}`
      );
    }

    return new StepResponse(authIdentity.id, authIdentity.id);
  },
  async (authIdentityId, { container }) => {
    if (!authIdentityId) {
      return;
    }

    const authModule = container.resolve<IAuthModuleService>(Modules.AUTH);
    await authModule.deleteAuthIdentities([authIdentityId]);
  }
);
