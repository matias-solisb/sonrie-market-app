import { ExecArgs, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { PICKUP_SCHEDULING_MODULE } from "../modules/pickup-scheduling";
import PickupSchedulingModuleService from "../modules/pickup-scheduling/service";

/*

Deja configurada la agenda de retiro (pickup-scheduling) con una capacidad
por defecto: pedidos por día y site.

Sin capacidad la agenda queda "sin configurar": el storefront no ofrece
fechas y el checkout se bloquea ("La agenda de retiro no está configurada").
`npm run seed` ya la configura (ver seed.ts); en un ambiente que no se
siembra (DEV/PRD con datos reales) se corre una vez después de
`npx medusa db:migrate`:

  # deja 50 si aún no hay capacidad; si ya hay, no la cambia
  npx medusa exec ./src/scripts/setup-pickup-scheduling.ts

  # fija la capacidad por defecto (también si ya había una)
  npx medusa exec ./src/scripts/setup-pickup-scheduling.ts 80

Los demás valores (lead-time 1 día, horizonte 14 días, lunes a viernes) se
crean con sus valores por defecto. La capacidad por site, los horarios y
los feriados se configuran desde el Admin (paso 7).

*/
export const DEFAULT_PICKUP_CAPACITY = 50;

export async function ensurePickupScheduling(
  container: MedusaContainer,
  capacidad?: number
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const pickup = container.resolve<PickupSchedulingModuleService>(
    PICKUP_SCHEDULING_MODULE
  );

  const current = await pickup.getSettings();

  if (capacidad === undefined && current.capacidad_por_defecto !== null) {
    logger.info(
      `Agenda de retiro ya configurada: ${current.capacidad_por_defecto} pedidos por día y site.`
    );
    return current;
  }

  const setting = await pickup.updateSettings({
    capacidad_por_defecto: capacidad ?? DEFAULT_PICKUP_CAPACITY,
  });

  logger.info(
    `Agenda de retiro: ${setting.capacidad_por_defecto} pedidos por día y site, ` +
      `desde ${setting.lead_time_dias} día(s) y hasta ${setting.horizonte_dias} días adelante, ` +
      `días ${setting.dias_abiertos_por_defecto.join(", ")} (1 = lunes).`
  );

  return setting;
}

export default async function setupPickupScheduling({
  container,
  args,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const [arg] = args ?? [];
  const capacidad = arg !== undefined ? Number(arg) : undefined;

  if (capacidad !== undefined && (!Number.isInteger(capacidad) || capacidad < 0)) {
    logger.error(`✘ Capacidad inválida: ${arg}. Usa un entero mayor o igual a 0.`);
    return;
  }

  await ensurePickupScheduling(container, capacidad);
}
