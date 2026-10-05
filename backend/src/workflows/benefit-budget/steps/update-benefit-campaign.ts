import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { BENEFIT_BUDGET_MODULE } from "../../../modules/benefit-budget";
import BenefitBudgetModuleService from "../../../modules/benefit-budget/service";

export type UpdateBenefitCampaignInput = {
  id: string;
  nombre?: string;
  descripcion?: string | null;
  tope_por_colaborador?: number;
  estado?: "activa" | "inactiva";
};

/*

Cambiar `tope_por_colaborador` afecta a los periodos que aún no tienen
fila: los saldos ya creados (el mes en curso, si el job ya corrió o el
colaborador ya compró) conservan el tope con que se abrieron. Para cambiar
el tope de alguien en el mes en curso, usar el override por colaborador.

*/
export const updateBenefitCampaignStep = createStep(
  "update-benefit-campaign",
  async (input: UpdateBenefitCampaignInput, { container }) => {
    const service =
      container.resolve<BenefitBudgetModuleService>(BENEFIT_BUDGET_MODULE);

    const previous = await service.retrieveBenefitCampaign(input.id);

    if (input.estado === "activa" && previous.periodo === "mensual") {
      const active = await service.findActiveCampaign();

      if (active && active.id !== input.id) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Ya existe una campaña mensual activa (${active.nombre}). Desactívala primero.`
        );
      }
    }

    const updated = await service.updateBenefitCampaigns(input);

    return new StepResponse(updated, previous);
  },
  async (previous, { container }) => {
    if (!previous) {
      return;
    }

    const service =
      container.resolve<BenefitBudgetModuleService>(BENEFIT_BUDGET_MODULE);

    await service.updateBenefitCampaigns({
      id: previous.id,
      nombre: previous.nombre,
      descripcion: previous.descripcion,
      tope_por_colaborador: previous.tope_por_colaborador,
      estado: previous.estado,
    });
  }
);
