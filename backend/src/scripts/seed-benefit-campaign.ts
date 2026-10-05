import { ExecArgs, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BENEFIT_BUDGET_MODULE } from "../modules/benefit-budget";
import BenefitBudgetModuleService from "../modules/benefit-budget/service";

/*

Crea la campaña de beneficio del MVP si no existe:
"Beneficio mensual", $50.000 por colaborador, mensual, bloqueo duro.

Sin una campaña activa el checkout se bloquea ("No hay una campaña de
beneficio activa"). `npm run seed` ya la crea (ver seed.ts); en un ambiente
que no se siembra (DEV/PRD con datos reales) se corre una vez después de
`npx medusa db:migrate`:

  npx medusa exec ./src/scripts/seed-benefit-campaign.ts

Es idempotente: si ya hay una campaña mensual activa, no hace nada.

*/
export async function ensureBenefitCampaign(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const benefitBudget = container.resolve<BenefitBudgetModuleService>(
    BENEFIT_BUDGET_MODULE
  );

  const existing = await benefitBudget.findActiveCampaign();

  if (existing) {
    logger.info(
      `Campaña de beneficio ya existe: ${existing.nombre} (${existing.id}).`
    );
    return existing;
  }

  const campaign = await benefitBudget.createBenefitCampaigns({
    nombre: "Beneficio mensual",
    descripcion: "Cupo mensual de $50.000 por colaborador, no acumulable.",
    tope_por_colaborador: 50000,
    periodo: "mensual",
    modo_exceso: "bloqueo_duro",
    estado: "activa",
  });

  logger.info(`Campaña de beneficio creada: ${campaign.id}.`);

  return campaign;
}

export default async function seedBenefitCampaign({ container }: ExecArgs) {
  await ensureBenefitCampaign(container);
}
