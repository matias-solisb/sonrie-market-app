import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { PICKUP_SCHEDULING_MODULE } from "../../../modules/pickup-scheduling";
import PickupSchedulingModuleService from "../../../modules/pickup-scheduling/service";
import {
  MarkRetiradoInput,
  MarkRetiradoResult,
} from "../../../modules/pickup-scheduling/types";

type Compensation = { booking_id: string } | null;

/**
 * Pasa el cupo del pedido a `retirado` (quién y cuándo). Si un paso
 * posterior falla, la compensación lo vuelve a `agendado`. Si ya estaba
 * retirado no hay nada que compensar.
 */
export const markRetiradoStep = createStep(
  "mark-pickup-retirado",
  async (input: MarkRetiradoInput, { container }) => {
    const service = container.resolve<PickupSchedulingModuleService>(
      PICKUP_SCHEDULING_MODULE
    );

    const result = await service.markRetirado(input);

    return new StepResponse<MarkRetiradoResult, Compensation>(
      result,
      result.retirado ? { booking_id: result.booking_id } : null
    );
  },
  async (compensation: Compensation, { container }) => {
    if (!compensation) {
      return;
    }

    const service = container.resolve<PickupSchedulingModuleService>(
      PICKUP_SCHEDULING_MODULE
    );

    await service.undoRetirado(compensation.booking_id);
  }
);
