import { completeCartWorkflow } from "@medusajs/core-flows";
import { StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  ContainerRegistrationKeys,
  MathBN,
  MedusaError,
} from "@medusajs/framework/utils";
import { getCartApprovalStatus } from "../../utils/get-cart-approval-status";
import { BENEFIT_BUDGET_MODULE } from "../../modules/benefit-budget";
import BenefitBudgetModuleService from "../../modules/benefit-budget/service";
import {
  findUnavailableItems,
  getPickupSite,
} from "../../utils/pickup-sites";

/*

Validación final del checkout (hook `validate` de completeCartWorkflow).
Corre antes de crear el pedido.

1. El carrito no puede estar pendiente de aprobación (B2B Starter).
2. Debe haber un colaborador logueado.
3. TODO(rut-auth / employee-sync): validar colaborador activo en SAP y
   habilitado por admin cuando existan esos campos.
4. Site de retiro (src/utils/pickup-sites.ts): el carrito debe tener un
   site elegido (`metadata.stock_location_id`), estar en el sales channel
   de ese site y tener su opción "Retiro en {site}". Lo deja así
   POST /store/carts/:id/pickup-site. Además se revisa el stock del site
   para responder en español antes de que el core falle al reservar.
5. Cupo de beneficio (módulo benefit-budget): valida
   `consumido + total <= tope` del periodo vigente (hora de Santiago) y
   registra el consumo en la misma transacción. El total incluye IVA.

Si un paso posterior del workflow falla (crear el pedido, reservar stock,
autorizar el pago), Medusa ejecuta la compensación de abajo y el consumo
se revierte. Si el carrito se completa por segunda vez (reintento),
`reserveConsumption` detecta el consumo existente por `cart_id` y no
descuenta de nuevo; en ese caso no hay nada que compensar.

Reemplaza la validación `checkSpendingLimit` del B2B Starter
(`employee.spending_limit`), que solo comparaba el total del carrito
contra el tope y no sumaba los pedidos anteriores del mes.

*/

type CompensationInput = { movement_id: string } | null;

completeCartWorkflow.hooks.validate(
  async ({ cart }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const {
      data: [queryCart],
    } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "approvals.*",
        "customer_id",
        "total",
        "metadata",
        "sales_channel_id",
        "shipping_methods.shipping_option_id",
        "items.variant_id",
        "items.title",
        "items.product_title",
        "items.quantity",
        "items.variant.manage_inventory",
        "items.variant.allow_backorder",
      ],
      filters: {
        id: cart.id,
      },
    });

    const { isPendingApproval } = getCartApprovalStatus(queryCart);

    if (isPendingApproval) {
      throw new Error("Cart is pending approval");
    }

    if (!queryCart.customer_id) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Debes iniciar sesión para completar la compra."
      );
    }

    const stockLocationId = queryCart.metadata?.stock_location_id as
      | string
      | undefined;
    const site = stockLocationId
      ? await getPickupSite(query, stockLocationId)
      : null;

    if (!site) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Elige un site de retiro en el carrito antes de confirmar el pedido."
      );
    }

    const hasPickupMethod = (queryCart.shipping_methods ?? []).some(
      (method: any) => method?.shipping_option_id === site.shipping_option_id
    );

    if (queryCart.sales_channel_id !== site.sales_channel_id || !hasPickupMethod) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `El carrito no está preparado para retiro en ${site.name}. Vuelve al carrito y confirma el site de retiro.`
      );
    }

    const unavailable = await findUnavailableItems(
      query,
      (queryCart.items ?? []).filter(Boolean).map((item: any) => ({
        ...item,
        title: item.product_title || item.title,
      })),
      site.sales_channel_id
    );

    if (unavailable.length) {
      const detalle = unavailable
        .map((i) => `${i.title} (pediste ${i.requested}, quedan ${i.available})`)
        .join(", ");

      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `No hay stock suficiente en ${site.name} para: ${detalle}.`
      );
    }

    // CLP no tiene decimales: se redondea por si el cálculo de IVA deja
    // fracciones de peso.
    const monto = Math.round(MathBN.convert(queryCart.total ?? 0).toNumber());

    if (monto <= 0) {
      return new StepResponse<undefined, CompensationInput>(undefined, null);
    }

    const benefitBudget: BenefitBudgetModuleService = container.resolve(
      BENEFIT_BUDGET_MODULE
    );

    const reservation = await benefitBudget.reserveConsumption({
      customer_id: queryCart.customer_id,
      cart_id: queryCart.id,
      monto,
    });

    return new StepResponse<undefined, CompensationInput>(
      undefined,
      reservation.created ? { movement_id: reservation.movement_id } : null
    );
  },
  async (input: CompensationInput, { container }) => {
    if (!input) {
      return;
    }

    const benefitBudget: BenefitBudgetModuleService = container.resolve(
      BENEFIT_BUDGET_MODULE
    );

    await benefitBudget.revertConsumption(input.movement_id);
  }
);
