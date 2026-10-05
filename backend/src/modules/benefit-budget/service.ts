import { Context } from "@medusajs/framework/types";
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils";
import { EntityManager } from "@mikro-orm/knex";
import { BenefitCampaign, BenefitMovement, EmployeeBudget } from "./models";
import {
  BenefitBalance,
  RefundOrderInput,
  RefundOrderResult,
  ReserveConsumptionInput,
  ReserveConsumptionResult,
  SetTopeOverrideInput,
} from "./types";
import { getPeriod, isValidPeriod } from "./utils/period";

/*

Servicio del módulo benefit-budget.

Además del CRUD que genera `MedusaService` (listBenefitCampaigns,
retrieveEmployeeBudget, createBenefitMovements, ...), expone:

- `reserveConsumption` / `revertConsumption`: consumo del checkout y su
  compensación (hook de completeCartWorkflow).
- `assignOrderToConsumption`: completa el `order_id` del consumo cuando se
  crea el pedido (subscriber `order.placed`).
- `refundOrder` / `undoRefund`: reintegro por anulación/rechazo y su
  compensación (subscriber `order.canceled`).
- `ensureBudgetsForPeriod`: crea las filas del mes por adelantado (job).
- `setTopeOverride`: excepción de tope para un colaborador en un periodo.
- `getBalance` / `getBalanceByPeriod`: saldo para storefront y admin.

Concurrencia: el consumo se suma con un UPDATE condicional
(`consumido + monto <= tope efectivo`). Postgres bloquea la fila y vuelve a
evaluar la condición, así que dos checkouts simultáneos del mismo
colaborador no pueden pasarse del tope aunque corran en instancias
distintas. No depende de locks en memoria ni en Redis.

*/

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const assertPeriod = (periodo: string) => {
  if (!isValidPeriod(periodo)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Periodo inválido: ${periodo}. Formato esperado: YYYY-MM.`
    );
  }
};

class BenefitBudgetModuleService extends MedusaService({
  BenefitCampaign,
  EmployeeBudget,
  BenefitMovement,
}) {
  /**
   * Campaña mensual activa, o null si no hay. Si hay más de una, error:
   * en el MVP debe existir exactamente una.
   */
  @InjectManager()
  async findActiveCampaign(@MedusaContext() sharedContext: Context = {}) {
    const campaigns = await this.listBenefitCampaigns(
      { estado: "activa", periodo: "mensual" },
      { take: 2 },
      sharedContext
    );

    if (campaigns.length > 1) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Hay más de una campaña de beneficio mensual activa; debe haber solo una."
      );
    }

    return campaigns[0] ?? null;
  }

  /**
   * Campaña mensual activa. Error si no hay ninguna.
   */
  @InjectManager()
  async getActiveCampaign(@MedusaContext() sharedContext: Context = {}) {
    const campaign = await this.findActiveCampaign(sharedContext);

    if (!campaign) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "No hay una campaña de beneficio activa. Contacta al administrador."
      );
    }

    return campaign;
  }

  /**
   * Saldo del colaborador en el periodo de `fecha` (por defecto, ahora).
   */
  @InjectManager()
  async getBalance(
    customerId: string,
    fecha: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<BenefitBalance> {
    return await this.getBalanceByPeriod(
      customerId,
      getPeriod(fecha),
      sharedContext
    );
  }

  /**
   * Saldo del colaborador en un periodo "YYYY-MM". No crea filas: si el
   * colaborador aún no tiene fila en el periodo, devuelve el tope completo
   * de la campaña.
   */
  @InjectManager()
  async getBalanceByPeriod(
    customerId: string,
    periodo: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<BenefitBalance> {
    assertPeriod(periodo);
    const campaign = await this.getActiveCampaign(sharedContext);

    const [budget] = await this.listEmployeeBudgets(
      { customer_id: customerId, campaign_id: campaign.id, periodo },
      { take: 1 },
      sharedContext
    );

    const tope = budget
      ? budget.tope_override ?? budget.tope
      : campaign.tope_por_colaborador;
    const consumido = budget?.consumido ?? 0;

    return {
      campaign_id: campaign.id,
      budget_id: budget?.id ?? null,
      periodo,
      tope,
      tope_override: budget?.tope_override ?? null,
      consumido,
      disponible: Math.max(tope - consumido, 0),
    };
  }

  /**
   * Valida `consumido + monto <= tope` y registra el consumo del carrito.
   * Idempotente por `cart_id`: si el carrito ya tiene su consumo (reintento
   * de completeCart), no vuelve a descontar y devuelve `created: false`.
   */
  @InjectTransactionManager()
  async reserveConsumption(
    input: ReserveConsumptionInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ReserveConsumptionResult> {
    const { customer_id, cart_id, monto } = input;

    if (!Number.isInteger(monto) || monto < 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Monto de beneficio inválido: ${monto}`
      );
    }

    const [existing] = await this.listBenefitMovements(
      { cart_id, tipo: "consumo" },
      { take: 1, relations: ["presupuesto"] },
      sharedContext
    );

    if (existing) {
      return {
        movement_id: existing.id,
        budget_id: existing.presupuesto.id,
        periodo: existing.presupuesto.periodo,
        created: false,
      };
    }

    const em = sharedContext.transactionManager as EntityManager;
    const campaign = await this.getActiveCampaign(sharedContext);
    const periodo = getPeriod(input.fecha ?? new Date());

    const budgetId = await this.ensureBudget_(
      em,
      customer_id,
      campaign.id,
      periodo,
      campaign.tope_por_colaborador
    );

    const updated = await em.execute(
      `UPDATE employee_budget
          SET consumido = consumido + ?, updated_at = now()
        WHERE id = ?
          AND deleted_at IS NULL
          AND consumido + ? <= COALESCE(tope_override, tope)
      RETURNING id`,
      [monto, budgetId, monto],
      "all"
    );

    if (!updated.length) {
      const budget = await this.retrieveEmployeeBudget(
        budgetId,
        {},
        sharedContext
      );
      const disponible = Math.max(
        (budget.tope_override ?? budget.tope) - budget.consumido,
        0
      );

      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Saldo de beneficio insuficiente: el pedido es de ${clp.format(
          monto
        )} y tu disponible es ${clp.format(disponible)}.`
      );
    }

    const movement = await this.createBenefitMovements(
      {
        tipo: "consumo",
        monto,
        cart_id,
        presupuesto_id: budgetId,
      },
      sharedContext
    );

    return {
      movement_id: movement.id,
      budget_id: budgetId,
      periodo,
      created: true,
    };
  }

  /**
   * Deshace un consumo: borra el movimiento y resta su monto del periodo
   * al que pertenece. Si el movimiento ya no existe, no hace nada.
   */
  @InjectTransactionManager()
  async revertConsumption(
    movementId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [movement] = await this.listBenefitMovements(
      { id: movementId, tipo: "consumo" },
      { take: 1, relations: ["presupuesto"] },
      sharedContext
    );

    if (!movement) {
      return;
    }

    const em = sharedContext.transactionManager as EntityManager;

    await em.execute(
      `UPDATE employee_budget
          SET consumido = GREATEST(consumido - ?, 0), updated_at = now()
        WHERE id = ?`,
      [movement.monto, movement.presupuesto.id],
      "all"
    );

    // Borrado físico: el índice único (cart_id, tipo) debe quedar libre
    // para que el colaborador pueda reintentar el checkout del mismo carrito.
    await this.deleteBenefitMovements(movement.id, sharedContext);
  }

  /**
   * Asigna el pedido al consumo de su carrito. Idempotente. Devuelve el id
   * del movimiento, o null si el carrito no tenía consumo (total 0).
   */
  @InjectTransactionManager()
  async assignOrderToConsumption(
    cartId: string,
    orderId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string | null> {
    const [movement] = await this.listBenefitMovements(
      { cart_id: cartId, tipo: "consumo" },
      { take: 1 },
      sharedContext
    );

    if (!movement) {
      return null;
    }

    if (movement.order_id !== orderId) {
      await this.updateBenefitMovements(
        { id: movement.id, order_id: orderId },
        sharedContext
      );
    }

    return movement.id;
  }

  /**
   * Reintegra el consumo de un pedido anulado/rechazado al periodo en que
   * se hizo (aunque ese mes ya haya cerrado). Idempotente por pedido:
   * un segundo reintegro del mismo pedido no hace nada.
   * Devuelve null si el pedido no consumió beneficio.
   */
  @InjectTransactionManager()
  async refundOrder(
    input: RefundOrderInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<RefundOrderResult | null> {
    const { order_id, cart_id } = input;

    const [alreadyRefunded] = await this.listBenefitMovements(
      { order_id, tipo: "reintegro" },
      { take: 1, relations: ["presupuesto"] },
      sharedContext
    );

    if (alreadyRefunded) {
      return {
        movement_id: alreadyRefunded.id,
        budget_id: alreadyRefunded.presupuesto.id,
        periodo: alreadyRefunded.presupuesto.periodo,
        monto: alreadyRefunded.monto,
        created: false,
      };
    }

    let [consumo] = await this.listBenefitMovements(
      { order_id, tipo: "consumo" },
      { take: 1, relations: ["presupuesto"] },
      sharedContext
    );

    // El subscriber de order.placed puede no haber corrido aún.
    if (!consumo && cart_id) {
      [consumo] = await this.listBenefitMovements(
        { cart_id, tipo: "consumo" },
        { take: 1, relations: ["presupuesto"] },
        sharedContext
      );
    }

    if (!consumo) {
      return null;
    }

    const em = sharedContext.transactionManager as EntityManager;

    await em.execute(
      `UPDATE employee_budget
          SET consumido = GREATEST(consumido - ?, 0), updated_at = now()
        WHERE id = ?`,
      [consumo.monto, consumo.presupuesto.id],
      "all"
    );

    const reintegro = await this.createBenefitMovements(
      {
        tipo: "reintegro",
        monto: consumo.monto,
        order_id,
        presupuesto_id: consumo.presupuesto.id,
      },
      sharedContext
    );

    return {
      movement_id: reintegro.id,
      budget_id: consumo.presupuesto.id,
      periodo: consumo.presupuesto.periodo,
      monto: consumo.monto,
      created: true,
    };
  }

  /**
   * Compensación de `refundOrder`: borra el reintegro y vuelve a sumar su
   * monto. No valida el tope (solo restaura el estado anterior).
   */
  @InjectTransactionManager()
  async undoRefund(
    movementId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [movement] = await this.listBenefitMovements(
      { id: movementId, tipo: "reintegro" },
      { take: 1, relations: ["presupuesto"] },
      sharedContext
    );

    if (!movement) {
      return;
    }

    const em = sharedContext.transactionManager as EntityManager;

    await em.execute(
      `UPDATE employee_budget
          SET consumido = consumido + ?, updated_at = now()
        WHERE id = ?`,
      [movement.monto, movement.presupuesto.id],
      "all"
    );

    await this.deleteBenefitMovements(movement.id, sharedContext);
  }

  /**
   * Crea las filas del periodo para los colaboradores que aún no la tienen,
   * con el tope vigente de la campaña. Idempotente. Devuelve cuántas creó.
   */
  @InjectTransactionManager()
  async ensureBudgetsForPeriod(
    customerIds: string[],
    periodo: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    assertPeriod(periodo);

    const ids = [...new Set(customerIds)].filter(Boolean);

    if (!ids.length) {
      return 0;
    }

    const em = sharedContext.transactionManager as EntityManager;
    const campaign = await this.getActiveCampaign(sharedContext);

    const values = ids.map(() => "(?, ?, ?, ?, ?, 0, now(), now())").join(", ");
    const params = ids.flatMap((customerId) => [
      generateEntityId(undefined, "ebud"),
      customerId,
      campaign.id,
      periodo,
      campaign.tope_por_colaborador,
    ]);

    const inserted = await em.execute(
      `INSERT INTO employee_budget
         (id, customer_id, campaign_id, periodo, tope, consumido, created_at, updated_at)
       VALUES ${values}
       ON CONFLICT DO NOTHING
       RETURNING id`,
      params,
      "all"
    );

    return inserted.length;
  }

  /**
   * Fija (o quita, con null) la excepción de tope de un colaborador en un
   * periodo. Crea la fila del periodo si no existe. Devuelve el override
   * anterior, para poder compensar.
   */
  @InjectTransactionManager()
  async setTopeOverride(
    input: SetTopeOverrideInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ budget_id: string; previous: number | null }> {
    const { customer_id, periodo, tope_override } = input;
    assertPeriod(periodo);

    if (
      tope_override !== null &&
      (!Number.isInteger(tope_override) || tope_override < 0)
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "El tope debe ser un monto entero mayor o igual a 0."
      );
    }

    const em = sharedContext.transactionManager as EntityManager;
    const campaign = await this.getActiveCampaign(sharedContext);

    const budgetId = await this.ensureBudget_(
      em,
      customer_id,
      campaign.id,
      periodo,
      campaign.tope_por_colaborador
    );

    const budget = await this.retrieveEmployeeBudget(
      budgetId,
      {},
      sharedContext
    );

    await this.updateEmployeeBudgets(
      { id: budgetId, tope_override },
      sharedContext
    );

    return { budget_id: budgetId, previous: budget.tope_override ?? null };
  }

  /**
   * Crea (si no existe) la fila del colaborador para la campaña y el
   * periodo, y devuelve su id. `ON CONFLICT DO NOTHING` evita la carrera
   * entre dos checkouts que crean el mismo periodo a la vez.
   */
  private async ensureBudget_(
    em: EntityManager,
    customerId: string,
    campaignId: string,
    periodo: string,
    tope: number
  ): Promise<string> {
    await em.execute(
      `INSERT INTO employee_budget
         (id, customer_id, campaign_id, periodo, tope, consumido, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, now(), now())
       ON CONFLICT DO NOTHING`,
      [generateEntityId(undefined, "ebud"), customerId, campaignId, periodo, tope],
      "all"
    );

    const [row] = await em.execute(
      `SELECT id FROM employee_budget
        WHERE customer_id = ? AND campaign_id = ? AND periodo = ?
          AND deleted_at IS NULL
        LIMIT 1`,
      [customerId, campaignId, periodo],
      "all"
    );

    if (!row?.id) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `No se pudo crear el saldo de beneficio del periodo ${periodo}.`
      );
    }

    return row.id;
  }
}

export default BenefitBudgetModuleService;
