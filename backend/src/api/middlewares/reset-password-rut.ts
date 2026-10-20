import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MiddlewareRoute } from "@medusajs/medusa";
import { normalizeRut } from "../../utils/rut";

/*

Solicitud de recuperación de contraseña con RUT (rut-auth, paso 8).

`POST /auth/customer/rut/reset-password` es una ruta del core: busca la
identidad con el `identifier` tal cual llega. Como el entity_id del provider
`rut` es el RUT normalizado ("12345678-5"), un "12.345.678-5" no encontraba
la cuenta y el correo no salía, sin ningún error visible.

Este middleware normaliza el identifier antes de la ruta. Si no es un RUT
válido se deja como viene: la ruta igual responde 201 (no revela si la cuenta
existe) y no se envía nada.

*/
export const normalizeResetIdentifier = (
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const body = req.body as { identifier?: unknown } | undefined;
  const rut = normalizeRut(body?.identifier);

  if (rut && body) {
    body.identifier = rut;
    const validated = (req as any).validatedBody;
    if (validated && typeof validated === "object") {
      validated.identifier = rut;
    }
  }

  next();
};

export const resetPasswordRutMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/auth/customer/rut/reset-password",
    middlewares: [normalizeResetIdentifier],
  },
];
