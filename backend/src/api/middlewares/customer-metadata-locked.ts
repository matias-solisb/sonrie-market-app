import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";

/*

`metadata` del customer: solo la escribe la plataforma (vulnerabilidad #6).

El core deja que el colaborador edite su propia `metadata` con
`POST /store/customers/me` (`StoreUpdateCustomer`). Esa metadata la ve el
Admin, así que no puede servir como dato de confianza: antes "Retiros del
día" leía el RUT desde `metadata.rut` y un colaborador podía ponerse el RUT
de otro para retirar en el mostrador. El RUT ahora sale de la identidad
`rut` (retiros/helpers.ts), y esta ruta además rechaza cualquier `metadata`
en el body con 400, para que nada nuevo dependa de un campo editable por el
usuario.

El storefront no manda `metadata` (el perfil solo envía nombre, apellido y
teléfono). El Admin (`POST /admin/customers/:id`) sigue pudiendo editarla.

*/
export const rejectCustomerMetadata = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const body = req.body as Record<string, unknown> | undefined;

  if (body && typeof body === "object" && "metadata" in body) {
    res.status(400).json({
      type: "invalid_data",
      message: "No está permitido modificar la metadata del cliente.",
    });
    return;
  }

  next();
};

export const customerMetadataLockedMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/customers/me",
    middlewares: [rejectCustomerMetadata],
  },
];
