import { validateAndTransformBody } from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { AdminAltaColaborador, AdminSetHabilitacion } from "./validators";

// Las rutas /admin/* ya exigen usuario admin autenticado (core de Medusa).
// Sin RBAC (Fase 2), cualquier usuario del Admin puede dar de alta,
// habilitar o deshabilitar colaboradores.
export const adminColaboradoresMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/colaboradores",
    middlewares: [validateAndTransformBody(AdminAltaColaborador)],
  },
  {
    method: ["POST"],
    matcher: "/admin/colaboradores/:customerId/habilitacion",
    middlewares: [validateAndTransformBody(AdminSetHabilitacion)],
  },
];
