import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { updateBenefitCampaignWorkflow } from "../../../../../workflows/benefit-budget/workflows";
import { AdminUpdateBenefitCampaignType } from "../../validators";

// POST /admin/benefit-budget/campaigns/:id — editar nombre, tope o estado.
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateBenefitCampaignType>,
  res: MedusaResponse
) => {
  const { result: campaign } = await updateBenefitCampaignWorkflow(
    req.scope
  ).run({
    input: { id: req.params.id, ...req.validatedBody },
  });

  res.json({ campaign });
};
