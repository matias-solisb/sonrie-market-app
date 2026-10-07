import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { PICKUP_SCHEDULING_MODULE } from "../../../modules/pickup-scheduling";
import PickupSchedulingModuleService from "../../../modules/pickup-scheduling/service";
import {
  EstadoBooking,
  ReleaseBookingInput,
} from "../../../modules/pickup-scheduling/types";

type Compensation = { booking_id: string; estado_anterior: EstadoBooking } | null;

export const releasePickupBookingStep = createStep(
  "release-pickup-booking",
  async (input: ReleaseBookingInput, { container }) => {
    const service = container.resolve<PickupSchedulingModuleService>(
      PICKUP_SCHEDULING_MODULE
    );

    const result = await service.releaseBookingByOrder(input);

    // Solo se compensa una liberación hecha en esta ejecución.
    return new StepResponse<typeof result, Compensation>(
      result,
      result?.released
        ? { booking_id: result.booking_id, estado_anterior: result.estado_anterior }
        : null
    );
  },
  async (compensation: Compensation, { container }) => {
    if (!compensation) {
      return;
    }

    const service = container.resolve<PickupSchedulingModuleService>(
      PICKUP_SCHEDULING_MODULE
    );

    await service.undoRelease(
      compensation.booking_id,
      compensation.estado_anterior
    );
  }
);
