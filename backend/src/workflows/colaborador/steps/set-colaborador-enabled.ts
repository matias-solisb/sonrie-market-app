import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { setEnabled } from "../../../modules/rut-auth/account-state";
import { maskRut, normalizeRut } from "../../../utils/rut";

/*

Cambia `enabled` de la identidad `rut` (rut-auth, paso 9). Ver
modules/rut-auth/account-state.ts.

Compensación: si un paso posterior falla, deja `enabled` y su trazabilidad
como estaban.

*/
export type SetColaboradorEnabledInput = {
  rut: string;
  enabled: boolean;
  /** Usuario del Admin que hace el cambio (para auditoría). */
  actor_id?: string | null;
};

export const setColaboradorEnabledStep = createStep(
  "set-colaborador-enabled",
  async (input: SetColaboradorEnabledInput, { container }) => {
    const rut = normalizeRut(input.rut);

    if (!rut) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `RUT inválido ("${input.rut ?? ""}").`
      );
    }

    const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
    const result = await setEnabled(pg, rut, input.enabled, input.actor_id ?? null);

    if (!result) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No hay un colaborador con RUT ${maskRut(rut)}.`
      );
    }

    return new StepResponse(
      { rut, ...result.current },
      { rut, previous: result.previous }
    );
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return;
    }

    const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
    await setEnabled(
      pg,
      compensation.rut,
      compensation.previous.enabled,
      compensation.previous.enabled_changed_by ?? null,
      compensation.previous.enabled_changed_at ?? null
    );
  }
);
