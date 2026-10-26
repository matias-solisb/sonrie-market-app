import { authenticate, validateAndTransformQuery } from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { deny } from "../../middlewares/deny";
import { approvalTransformQueryConfig } from "./query-config";
import { StoreGetApprovals } from "./validators";

/*
Vulnerabilidad #1 (docs/vulnerabilidades.md):
- GET /store/approvals: cualquier colaborador logueado, pero solo ve sus
  propios carritos en aprobación (filtro por customer_id en route.ts). Lo usa
  el panel "Pending Approvals" de /account/orders.
- POST /store/approvals/:id (aprobar/rechazar): bloqueado. Las aprobaciones
  se resuelven solo desde el Admin (/admin/approvals).
*/
export const storeApprovalsMiddlewares: MiddlewareRoute[] = [
  {
    method: "ALL",
    matcher: "/store/approvals*",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/approvals",
    middlewares: [
      validateAndTransformQuery(
        StoreGetApprovals,
        approvalTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/store/approvals/:id",
    middlewares: [
      deny("Las aprobaciones se gestionan desde el Admin."),
    ],
  },
];
