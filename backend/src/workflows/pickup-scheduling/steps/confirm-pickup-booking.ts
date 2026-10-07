import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { PICKUP_SCHEDULING_MODULE } from "../../../modules/pickup-scheduling";
import PickupSchedulingModuleService from "../../../modules/pickup-scheduling/service";

export type ConfirmPickupBookingInput = {
  order_id: string;
  cart_id: string;
};

// Sin compensación: solo completa un dato (order_id) y el estado, y es
// idempotente.
export const confirmPickupBookingStep = createStep(
  "confirm-pickup-booking",
  async (input: ConfirmPickupBookingInput, { container }) => {
    const service = container.resolve<PickupSchedulingModuleService>(
      PICKUP_SCHEDULING_MODULE
    );

    const bookingId = await service.confirmBooking(
      input.cart_id,
      input.order_id
    );

    return new StepResponse(bookingId);
  }
);
