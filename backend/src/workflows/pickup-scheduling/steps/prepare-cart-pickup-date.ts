import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { PICKUP_SCHEDULING_MODULE } from "../../../modules/pickup-scheduling";
import PickupSchedulingModuleService from "../../../modules/pickup-scheduling/service";

export type PrepareCartPickupDateInput = {
  cart_id: string;
  customer_id: string;
  fecha: string;
};

export type PrepareCartPickupDateOutput = {
  stock_location_id: string;
  fecha: string;
  cart_update: {
    id: string;
    metadata: Record<string, unknown>;
  };
};

/*

Valida que el carrito sea del colaborador, que ya tenga site de retiro y
que la fecha se pueda reservar en ese site ahora mismo
(`assertDateBookable`). No reserva el cupo: eso ocurre al confirmar el
pedido (hook validate-cart-completion).

Solo lee; no tiene compensación.

*/
export const prepareCartPickupDateStep = createStep(
  "prepare-cart-pickup-date",
  async (input: PrepareCartPickupDateInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const {
      data: [cart],
    } = await query.graph({
      entity: "cart",
      fields: ["id", "customer_id", "completed_at", "metadata"],
      filters: { id: input.cart_id },
    });

    // Mismo error si no existe o es de otro colaborador: no revelar ids.
    if (!cart || cart.customer_id !== input.customer_id) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Carrito ${input.cart_id} no encontrado.`
      );
    }

    if (cart.completed_at) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Este carrito ya se convirtió en un pedido."
      );
    }

    const stockLocationId = cart.metadata?.stock_location_id as
      | string
      | undefined;

    if (!stockLocationId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Elige primero el site de retiro."
      );
    }

    const pickup = container.resolve<PickupSchedulingModuleService>(
      PICKUP_SCHEDULING_MODULE
    );

    await pickup.assertDateBookable(stockLocationId, input.fecha);

    return new StepResponse<PrepareCartPickupDateOutput>({
      stock_location_id: stockLocationId,
      fecha: input.fecha,
      cart_update: {
        id: cart.id,
        metadata: { pickup_date: input.fecha },
      },
    });
  }
);
