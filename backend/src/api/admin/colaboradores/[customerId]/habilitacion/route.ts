import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { getRutIdentityByCustomer } from "../../../../../utils/rut-identity";
import { setColaboradorEnabledWorkflow } from "../../../../../workflows/colaborador/workflows";
import { AdminSetHabilitacionType } from "../../validators";

/*

POST /admin/colaboradores/:customerId/habilitacion
Body: { enabled: boolean }

Habilita o deshabilita al colaborador (rut-auth, paso 9). Registra qué
usuario del Admin hizo el cambio. Ver el workflow set-colaborador-enabled.

*/
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSetHabilitacionType>,
  res: MedusaResponse
) => {
  const identity = await getRutIdentityByCustomer(req.scope, req.params.customerId);

  if (!identity) {
    return res.status(404).json({
      type: "not_found",
      message: "Este cliente no tiene cuenta de colaborador (RUT).",
    });
  }

  const { result } = await setColaboradorEnabledWorkflow(req.scope).run({
    input: {
      rut: identity.rut,
      enabled: req.validatedBody.enabled,
      actor_id: req.auth_context?.actor_id ?? null,
    },
  });

  res.json({
    colaborador: {
      rut: result.rut,
      enabled: result.enabled,
      enabled_changed_at: result.enabled_changed_at ?? null,
      enabled_changed_by: result.enabled_changed_by ?? null,
    },
  });
};
