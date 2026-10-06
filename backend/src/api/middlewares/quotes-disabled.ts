import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { MiddlewareRoute } from "@medusajs/medusa";

/*

Cotizaciones (quotes) del B2B Starter: DESACTIVADAS en Sonríe Market.

Ningún documento del proyecto las pide y su flujo crea pedidos sin pasar por
completeCart, o sea, sin descontar el cupo de beneficio. No se borran porque
no se sabe si se querrán a futuro: estas rutas responden 404 salvo que la
variable de entorno QUOTES_ENABLED sea "true".

Antes de reactivarlas, el pedido que nace de una cotización aceptada debe
validar y registrar el consumo de beneficio (benefit-budget).

Se registra SIN `method` y al principio de la lista, así corre antes que la
autenticación y los validadores de /store/quotes y /admin/quotes.

*/
export const quotesEnabled = () => process.env.QUOTES_ENABLED === "true";

const blockQuotes = (
  _req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) => {
  if (quotesEnabled()) {
    return next();
  }

  next(
    new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Las cotizaciones no están disponibles."
    )
  );
};

export const quotesDisabledMiddlewares: MiddlewareRoute[] = [
  { matcher: "/store/quotes*", middlewares: [blockQuotes] },
  { matcher: "/admin/quotes*", middlewares: [blockQuotes] },
];
