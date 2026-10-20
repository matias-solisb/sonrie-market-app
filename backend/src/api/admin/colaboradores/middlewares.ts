import { validateAndTransformBody } from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { AdminSetHabilitacion } from "./validators";

// Las rutas /admin/* ya exigen usuario admin autenticado (core de Medusa).
// Sin RBAC (Fase 2), cualquier usuario del Admin puede habilitar o
// deshabilitar colaboradores.
export const adminColaboradoresMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/colaboradores/:customerId/habilitacion",
    middlewares: [validateAndTransformBody(AdminSetHabilitacion)],
  },
];
