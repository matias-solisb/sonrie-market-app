import { InferTypeOf } from "@medusajs/framework/types";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { BENEFIT_BUDGET_MODULE } from "../../../modules/benefit-budget";
import { BenefitCampaign } from "../../../modules/benefit-budget/models";
import BenefitBudgetModuleService from "../../../modules/benefit-budget/service";
import {
  getPeriod,
  nextPeriod,
} from "../../../modules/benefit-budget/utils/period";

export type UpdateBenefitCampaignInput = {
  id: string;
  nombre?: string;
  descripcion?: string | null;
  tope_por_colaborador?: number;
  estado?: "activa" | "inactiva";
  /** Usuario del Admin que hace el cambio (auditoría). */
  actor_id?: string | null;
};

export type UpdateBenefitCampaignResult = {
  campaign: InferTypeOf<typeof BenefitCampaign>;
  /** Periodo desde el que rige el tope nuevo; null si no cambió el tope. */
  rige_desde: string | null;
  /** Id del registro de auditoría; null si no cambió nada. */
  change_id: string | null;
};

const AUDITED_FIELDS = [
  "nombre",
  "descripcion",
  "tope_por_colaborador",
  "estado",
] as const;

/*

Cambiar `tope_por_colaborador` afecta a los periodos que aún no tienen
fila: los saldos ya creados (el mes en curso, si el job ya corrió o el
colaborador ya compró) conservan el tope con que se abrieron. Por eso el
cambio "rige desde" el mes siguiente. Excepción conocida y aceptada en el
MVP: quien aún no tiene fila en el mes en curso (un alta nueva) recibe el
tope nuevo de inmediato. Para cambiar el tope de alguien en el mes en
curso, usar el override por colaborador.

Cada cambio real queda auditado (tabla benefit_campaign_change + log).

*/
export const updateBenefitCampaignStep = createStep(
  "update-benefit-campaign",
  async (input: UpdateBenefitCampaignInput, { container }) => {
    const service =
      container.resolve<BenefitBudgetModuleService>(BENEFIT_BUDGET_MODULE);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    const { actor_id, ...update } = input;
    const previous = await service.retrieveBenefitCampaign(update.id);

    if (update.estado === "activa" && previous.periodo === "mensual") {
      const active = await service.findActiveCampaign();

      if (active && active.id !== update.id) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Ya existe una campaña mensual activa (${active.nombre}). Desactívala primero.`
        );
      }
    }

    const cambios: Record<string, { anterior: unknown; nuevo: unknown }> = {};

    for (const field of AUDITED_FIELDS) {
      const nuevo = update[field];
      const anterior = previous[field] ?? null;

      if (nuevo !== undefined && nuevo !== anterior) {
        cambios[field] = { anterior, nuevo };
      }
    }

    const campaign = (await service.updateBenefitCampaigns(
      update
    )) as InferTypeOf<typeof BenefitCampaign>;

    if (!Object.keys(cambios).length) {
      return new StepResponse<UpdateBenefitCampaignResult, any>(
        { campaign, rige_desde: null, change_id: null },
        { previous, change_id: null }
      );
    }

    const rige_desde = cambios.tope_por_colaborador
      ? nextPeriod(getPeriod())
      : null;

    const change = await service.createBenefitCampaignChanges({
      campaign_id: previous.id,
      actor_id: actor_id ?? null,
      cambios,
      rige_desde,
    });

    logger.info(
      `benefit-budget: campaña ${previous.id} (${previous.nombre}) modificada por ${
        actor_id ?? "sistema"
      }: ${JSON.stringify(cambios)}${rige_desde ? `; tope rige desde ${rige_desde}` : ""}.`
    );

    return new StepResponse<UpdateBenefitCampaignResult, any>(
      { campaign, rige_desde, change_id: change.id },
      { previous, change_id: change.id }
    );
  },
  async (data, { container }) => {
    if (!data?.previous) {
      return;
    }

    const { previous, change_id } = data;
    const service =
      container.resolve<BenefitBudgetModuleService>(BENEFIT_BUDGET_MODULE);

    await service.updateBenefitCampaigns({
      id: previous.id,
      nombre: previous.nombre,
      descripcion: previous.descripcion,
      tope_por_colaborador: previous.tope_por_colaborador,
      estado: previous.estado,
    });

    if (change_id) {
      await service.deleteBenefitCampaignChanges(change_id);
    }
  }
);
