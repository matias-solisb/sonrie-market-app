import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { updateBenefitCampaignWorkflow } from "../../../../../workflows/benefit-budget/workflows";
import { AdminUpdateBenefitCampaignType } from "../../validators";

/*

POST /admin/benefit-budget/campaigns/:id — editar nombre, tope o estado.

Respuesta: { campaign, rige_desde }. `rige_desde` ("YYYY-MM") es el mes
desde el que rige un tope nuevo (el siguiente); null si no cambió el tope.
El cambio queda auditado con el usuario del Admin que lo hizo.

*/
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateBenefitCampaignType>,
  res: MedusaResponse
) => {
  const { result } = await updateBenefitCampaignWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      ...req.validatedBody,
      actor_id: req.auth_context?.actor_id ?? null,
    },
  });

  res.json({ campaign: result.campaign, rige_desde: result.rige_desde });
};
