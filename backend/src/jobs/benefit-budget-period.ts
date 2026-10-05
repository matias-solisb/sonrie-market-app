import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BENEFIT_BUDGET_MODULE } from "../modules/benefit-budget";
import BenefitBudgetModuleService from "../modules/benefit-budget/service";
import { getPeriod } from "../modules/benefit-budget/utils/period";

/*

Apertura del periodo del beneficio (spec §4.2, "scheduled job de reinicio").

No hay que "resetear" nada: el saldo de cada mes es una fila distinta de
`employee_budget`, y el checkout la crea si no existe. Este job solo crea
por adelantado la fila del mes para todos los colaboradores, con el tope
vigente de la campaña, para que:
- la reportería vea a todos (también a quienes no compran: adopción);
- el tope del mes quede fijado al inicio del periodo.

Idempotente (ON CONFLICT DO NOTHING). Si el worker estuvo caído a la
medianoche, no se pierde nada: el checkout crea la fila igual, y la
próxima ejecución completa a los que falten.

Corre a diario (00:10) y no solo el día 1 (`5 0 1 * *` en la spec):
1. Con `workflow-engine-inmemory` (el que usa hoy medusa-config.ts), Medusa
   programa la próxima ejecución con un `setTimeout`; un cron mensual queda
   a más de 24,8 días (el máximo de `setTimeout`) y Node lo ejecuta tras
   1 ms, en bucle. Verificado en Medusa 2.21. Con un cron diario el plazo
   siempre es menor a un día.
2. Así también se abren los saldos de colaboradores que se dan de alta a
   mitad de mes, y la spec ya pide un job diario para campañas por fecha.
Como es idempotente, correrlo todos los días no cambia nada ya creado.

El cron se evalúa en la zona horaria del proceso: el worker debe correr
con TZ=America/Santiago (spec §4.2 y documento técnico §4). El periodo se
calcula siempre en hora de Santiago (utils/period.ts), así que si el job
corre antes de la medianoche chilena solo completa el mes que termina.

*/
const BATCH_SIZE = 500;

export default async function benefitBudgetPeriodJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const service = container.resolve<BenefitBudgetModuleService>(
    BENEFIT_BUDGET_MODULE
  );

  const campaign = await service.findActiveCampaign();

  if (!campaign) {
    logger.warn("benefit-budget: no hay campaña activa; no se abre el periodo.");
    return;
  }

  const periodo = getPeriod();
  let skip = 0;
  let created = 0;

  while (true) {
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id"],
      pagination: { skip, take: BATCH_SIZE, order: { created_at: "ASC" } },
    });

    if (!customers.length) {
      break;
    }

    created += await service.ensureBudgetsForPeriod(
      customers.map((c) => c.id),
      periodo
    );

    skip += customers.length;
  }

  logger.info(
    `benefit-budget: periodo ${periodo} abierto (${created} saldos nuevos, ${skip} colaboradores revisados).`
  );
}

export const config = {
  name: "benefit-budget-period",
  schedule: "10 0 * * *",
};
