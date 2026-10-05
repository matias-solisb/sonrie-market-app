import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { assignOrderToBenefitConsumptionWorkflow } from "../workflows/benefit-budget/workflows";

/*

Al crearse un pedido, asocia el consumo de beneficio (registrado en el
checkout por `cart_id`) con el pedido. Así el Admin y la reportería ven
qué pedido consumió cuánto, y el reintegro por anulación encuentra el
consumo por `order_id`.

*/
export default async function benefitBudgetOrderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "cart.id"],
    filters: { id: data.id },
  });

  const cartId = (order as any)?.cart?.id;

  if (!cartId) {
    return;
  }

  await assignOrderToBenefitConsumptionWorkflow(container).run({
    input: { order_id: data.id, cart_id: cartId },
  });
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
