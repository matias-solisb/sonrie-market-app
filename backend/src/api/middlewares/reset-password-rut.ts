import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { MiddlewareRoute } from "@medusajs/medusa";
import { auditAuth, clientIp, colaboradorRef } from "../../utils/auth-audit";
import { normalizeRut } from "../../utils/rut";
import { getCustomerIdByRut } from "../../utils/rut-identity";

/*

Recuperación de contraseña con RUT (rut-auth, pasos 8 y 10).

1. `POST /auth/customer/rut/reset-password` (solicitud) es una ruta del core:
   busca la identidad con el `identifier` tal cual llega. Como el entity_id
   del provider `rut` es el RUT normalizado ("12345678-5"), un
   "12.345.678-5" no encontraba la cuenta y el correo no salía, sin ningún
   error visible.

   `normalizeResetIdentifier` normaliza el identifier antes de la ruta. Si no
   es un RUT válido se deja como viene: la ruta igual responde 201 (no revela
   si la cuenta existe) y no se envía nada.

   Auditoría: registra auth.reset_solicitado con `rut_ref` (todavía no se
   sabe si la cuenta existe, y buscarla acá cambiaría el tiempo de respuesta
   según exista o no). Lo que pasó después lo registra el subscriber
   (auth.reset_enviado / auth.reset_no_enviado, con el mismo rut_ref). Un RUT
   que no existe solo deja reset_solicitado: el core no emite el evento.

2. `POST /auth/customer/rut/update` (clave nueva con el token del correo):
   `auditResetCompletion` registra el resultado cuando la respuesta ya salió
   (auth.cambio_clave con origen "reset", o auth.cambio_clave_fallido). El
   provider no lo puede hacer: no sabe si lo llama el reset o el cambio de
   clave, y el body del reset lo escribe el cliente.

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

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  auditAuth(logger, "auth.reset_solicitado", {
    ...(rut ? colaboradorRef(null, rut, logger) : { customer_id: null, motivo: "rut_invalido" }),
    ...clientIp(req.headers),
  });

  next();
};

export const auditResetCompletion = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const origin = clientIp(req.headers);

  res.on("finish", () => {
    void (async () => {
      const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
      // Con un token válido, auth_context.actor_id es el entity_id: el RUT.
      const rut = normalizeRut((req as any).auth_context?.actor_id);
      const customerId = rut
        ? await getCustomerIdByRut(req.scope, rut).catch(() => null)
        : null;
      const who = rut
        ? colaboradorRef(customerId, rut, logger)
        : { customer_id: null };

      if (res.statusCode >= 200 && res.statusCode < 300) {
        auditAuth(logger, "auth.cambio_clave", { ...who, origen: "reset", ...origin });
        return;
      }

      // Sin RUT, el token no pasó la validación del core (vencido, ya usado
      // o falso). Con RUT, lo rechazó el provider (política de clave).
      auditAuth(logger, "auth.cambio_clave_fallido", {
        ...who,
        origen: "reset",
        motivo: rut ? "rechazada" : "enlace_invalido",
        http_status: res.statusCode,
        ...origin,
      });
    })().catch(() => undefined);
  });

  next();
};

export const resetPasswordRutMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/auth/customer/rut/reset-password",
    middlewares: [normalizeResetIdentifier],
  },
  {
    method: ["POST"],
    matcher: "/auth/customer/rut/update",
    middlewares: [auditResetCompletion],
  },
];
