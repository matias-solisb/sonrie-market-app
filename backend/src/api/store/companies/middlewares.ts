import { MiddlewareRoute } from "@medusajs/framework";
import { deny } from "../../middlewares/deny";

/*
Vulnerabilidad #1 (docs/vulnerabilidades.md): las rutas /store/companies*
exponían a cualquier colaborador logueado los datos de todos los demás
(nombre, correo, teléfono, cupo) vía `*employees.customer`.

En Sonríe Market la empresa, sus colaboradores y la configuración de
aprobaciones se gestionan solo desde el Admin (backoffice, /admin/companies).
La tienda no tiene nada que leer ni escribir acá: todo /store/companies*
responde 403, autenticado o no.

Los handlers (route.ts) quedan sin uso; este middleware corre antes que ellos.
*/
export const storeCompaniesMiddlewares: MiddlewareRoute[] = [
  {
    method: "ALL",
    matcher: "/store/companies*",
    middlewares: [deny("Las empresas se gestionan desde el Admin.")],
  },
];
