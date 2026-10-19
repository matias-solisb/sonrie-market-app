import { IAuthModuleService } from "@medusajs/framework/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

/*

Crea la identidad de auth del colaborador con el provider `emailpass`.

Interino: cuando exista rut-auth, este paso se reemplaza por uno que
registre con el provider `rut` (entity_id = RUT normalizado y clave
inicial derivada del RUT). El resto del workflow de alta no cambia.

Compensación: borra la identidad creada si un paso posterior falla.

*/
export const registerEmailpassIdentityStep = createStep(
  "register-emailpass-identity",
  async (input: { email: string; password: string }, { container }) => {
    const authModule = container.resolve<IAuthModuleService>(Modules.AUTH);

    const { success, authIdentity, error } = await authModule.register(
      "emailpass",
      { body: { email: input.email, password: input.password } }
    );

    if (!success || !authIdentity) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `No se pudo crear la identidad de ${input.email}: ${error ?? "error desconocido"}`
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
