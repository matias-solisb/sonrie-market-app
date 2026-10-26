import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { auditAuth, clientIp } from "../../../utils/auth-audit";
import { altaColaborador } from "../../../utils/colaborador-alta";
import { AdminAltaColaboradorType } from "./validators";

/*

POST /admin/colaboradores
Body: { rut, email, first_name, last_name, phone? }

Alta de un colaborador desde el Admin (widget "Alta de colaborador" sobre la
lista de Clientes). Misma lógica que el script alta-colaborador
(src/utils/colaborador-alta.ts): idempotente por RUT, clave inicial generada
por la plataforma, `metadata.origen = "manual"`.

  201 creado      → customer + identidad rut + employee
  200 vinculado   → el RUT ya tenía cuenta sin employee: se le agregó
  409 ya_existe   → el RUT ya es colaborador; no se hace nada
  409 revisar     → identidad sin customer; revisar a mano
  400 invalido    → RUT / correo / nombre inválidos
  400 error       → el workflow falló (p. ej. correo ya usado) y revirtió todo

Auditoría: `auth.alta` (solo creado / vinculado), con el usuario del Admin y
el customer_id; sin RUT ni correo (ver utils/auth-audit.ts).

⚠️ Sin RBAC (Fase 2), cualquier usuario del Admin puede dar de alta.

*/
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminAltaColaboradorType>,
  res: MedusaResponse
) => {
  const result = await altaColaborador(req.scope, {
    ...req.validatedBody,
    origen: "manual",
  });

  if (result.status === "creado" || result.status === "vinculado") {
    auditAuth(req.scope.resolve(ContainerRegistrationKeys.LOGGER), "auth.alta", {
      customer_id: result.customer_id,
      resultado: result.status,
      origen: "manual",
      actor_id: req.auth_context?.actor_id ?? null,
      ...clientIp(req.headers),
    });

    return res.status(result.status === "creado" ? 201 : 200).json({
      colaborador: {
        status: result.status,
        customer_id: result.customer_id,
        employee_id: result.employee_id,
      },
    });
  }

  if (result.status === "ya_existe") {
    return res.status(409).json({
      type: "duplicate_error",
      message: "Ese RUT ya es colaborador.",
      customer_id: result.customer_id,
    });
  }

  if (result.status === "revisar") {
    return res.status(409).json({ type: "conflict", message: result.message });
  }

  return res.status(400).json({ type: "invalid_data", message: result.message });
};
