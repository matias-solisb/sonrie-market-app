import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { refundBenefitBudgetWorkflow } from "../workflows/benefit-budget/workflows";

/*

Al anularse un pedido, reintegra su consumo de beneficio al periodo en que
se hizo la compra. Idempotente: si el evento llega dos veces, el segundo
reintegro no hace nada.

Se pasa también el `cart_id` por si el subscriber de `order.placed` aún no
alcanzó a asociar el consumo con el pedido.

*/
export default async function benefitBudgetOrderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "cart.id"],
    filters: { id: data.id },
  });

  const { result } = await refundBenefitBudgetWorkflow(container).run({
    input: { order_id: data.id, cart_id: (order as any)?.cart?.id ?? null },
  });

  if (result?.created) {
    logger.info(
      `benefit-budget: reintegro de ${result.monto} al periodo ${result.periodo} por anulación del pedido ${data.id}.`
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
};
