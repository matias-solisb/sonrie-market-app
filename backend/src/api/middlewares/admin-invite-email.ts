import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { isValidEmail, normalizeEmail } from "../../utils/email";

/*

Invitaciones del Admin: valida el formato del correo.

El core de Medusa acepta `POST /admin/invites` con cualquier string como
correo (p. ej. "operador@") y crea una invitación que nunca llega a nadie.
Este middleware responde 400 antes de llegar al core, con la misma regla que
el alta de colaboradores (src/utils/email.ts).

*/
const validateInviteEmail = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const email = normalizeEmail((req.body as any)?.email);

  if (!isValidEmail(email)) {
    res.status(400).json({
      type: "invalid_data",
      message: `Correo inválido para la invitación: "${(req.body as any)?.email ?? ""}".`,
    });
    return;
  }

  next();
};

export const adminInviteEmailMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/invites",
    middlewares: [validateInviteEmail],
  },
];
