import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { getRutIdentityByCustomer } from "../../../../utils/rut-identity";

/*

GET /admin/colaboradores/:customerId

Estado de la cuenta del colaborador para el widget del Admin (detalle del
cliente): RUT, habilitado, cambio de clave pendiente y bloqueo por intentos.
404 si el customer no tiene identidad `rut` (no es un colaborador).

El hash nunca sale de acá (getRutIdentityByCustomer lo descarta).

*/
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const identity = await getRutIdentityByCustomer(req.scope, req.params.customerId);

  if (!identity) {
    return res.status(404).json({
      type: "not_found",
      message: "Este cliente no tiene cuenta de colaborador (RUT).",
    });
  }

  const { state } = identity;
  const lockedUntil =
    state.locked_until && new Date(state.locked_until).getTime() > Date.now()
      ? state.locked_until
      : null;

  res.json({
    colaborador: {
      rut: identity.rut,
      enabled: state.enabled !== false,
      enabled_changed_at: state.enabled_changed_at ?? null,
      enabled_changed_by: state.enabled_changed_by ?? null,
      must_change_password: state.must_change_password === true,
      locked_until: lockedUntil,
    },
  });
};
