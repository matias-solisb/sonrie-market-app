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

/*

Validación final del checkout (hook `validate` de completeCartWorkflow).
Corre antes de crear el pedido.

1. El carrito no puede estar pendiente de aprobación (B2B Starter).
2. Debe haber un colaborador logueado.
3. TODO(rut-auth / employee-sync): validar colaborador activo en SAP y
   habilitado por admin cuando existan esos campos.
4. Cupo de beneficio (módulo benefit-budget): valida
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
      fields: ["id", "approvals.*", "customer_id", "total"],
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
