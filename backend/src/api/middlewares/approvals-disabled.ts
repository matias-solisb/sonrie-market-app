import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { MiddlewareRoute } from "@medusajs/medusa";

/*

Aprobaciones de carrito (B2B Starter): DESACTIVADAS en Sonríe Market.

No son parte del MVP: "excepciones y aprobaciones" es la Fase 2e del
roadmap, con el perfil Aprobador en el backoffice. Además el flujo no
funcionaba de punta a punta: el checkout del storefront decide si pide
aprobación leyendo `cart.company.approval_settings`, y la Store API no
devuelve `company` en el carrito. Activar la aprobación en el Admin daba
una sensación de control que no se aplicaba en el checkout.

Con APPROVALS_ENABLED distinto de "true" responden 404:
- POST /store/carts/:id/approvals         (pedir aprobación; con esto queda
                                           cerrada la vulnerabilidad #10: no
                                           validaba que el carrito fuera del
                                           usuario)
- /admin/approvals*                       (bandeja de aprobación del Admin)
- POST /admin/companies/:id/approval-settings (activar la aprobación)

Se mantiene GET /store/approvals (solo los carritos del propio colaborador)
para el panel "Pending Approvals" de /account/orders, que queda inactivo
mientras no haya aprobaciones.

Antes de reactivar (Fase 2e): exponer approval_settings al checkout,
validar dueño del carrito en POST /store/carts/:id/approvals, perfil
Aprobador (RBAC, Fase 2c) y restaurar la página Approvals del Admin.

Se registra al principio de la lista, igual que quotes-disabled.ts, para
correr antes que la autenticación y los validadores de esas rutas.

*/
export const approvalsEnabled = () => process.env.APPROVALS_ENABLED === "true";

const blockApprovals = (
  _req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) => {
  if (approvalsEnabled()) {
    return next();
  }

  next(
    new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Las aprobaciones no están disponibles."
    )
  );
};

export const approvalsDisabledMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/carts/:id/approvals",
    middlewares: [blockApprovals],
  },
  { matcher: "/admin/approvals*", middlewares: [blockApprovals] },
  {
    method: ["POST"],
    matcher: "/admin/companies/:id/approval-settings",
    middlewares: [blockApprovals],
  },
];
