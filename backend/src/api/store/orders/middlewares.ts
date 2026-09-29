import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { MiddlewareRoute } from "@medusajs/medusa";

/*

Filtro por fecha (`created_at`) para el endpoint CORE `GET /store/orders`.

El validador de Medusa para esa ruta (`StoreGetOrdersParams`) solo acepta
`id` y `status`, y rechaza cualquier otro campo con "Unrecognized fields".
Como no se puede ampliar ese validador desde el proyecto, esto funciona en
dos pasos alrededor de él:

1. `extractCreatedAtFilter` — se registra SIN `method`, así Medusa lo trata
   como middleware "global" y lo ejecuta ANTES que los middlewares del core
   para esta ruta (ver `routes-sorter.js` del framework). Saca
   `created_at` del query-string para que el validador del core no lo vea,
   y lo guarda validado en `req.__createdAtFilter`.

2. `applyCreatedAtFilter` — se registra con `method: GET`, así corre DESPUÉS
   del `validateAndTransformQuery` del core (los middlewares del core se
   registran antes que los del proyecto), y agrega el filtro a
   `req.filterableFields`, que el route handler del core pasa tal cual a
   `getOrdersListWorkflow` (junto con el `customer_id` del cliente
   autenticado, que el handler pone siempre).

Formato aceptado (el que manda el storefront, ver
`storefront/src/app/[countryCode]/(main)/account/@dashboard/orders/page.tsx`):
  ?created_at[$gte]=YYYY-MM-DD&created_at[$lte]=YYYY-MM-DD

Una fecha sola (sin hora) en `$lte` se toma hasta el final de ese día, para
que "Fecha hasta" incluya los pedidos de ese mismo día.

*/

type CreatedAtFilter = { $gte?: string; $lte?: string };

type RequestWithCreatedAt = MedusaRequest & {
  __createdAtFilter?: CreatedAtFilter;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const parseDate = (value: unknown, endOfDay: boolean): string => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Fecha inválida en el filtro created_at: ${String(value)}`
    );
  }

  if (DATE_ONLY.test(value)) {
    return endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`;
  }

  return new Date(value).toISOString();
};

const isOrdersListPath = (req: MedusaRequest) =>
  req.method === "GET" &&
  req.originalUrl.split("?")[0].replace(/\/+$/, "") === "/store/orders";

const extractCreatedAtFilter = (
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) => {
  if (!isOrdersListPath(req)) {
    return next();
  }

  const query = req.query as Record<string, any>;
  const raw = query.created_at;

  if (raw === undefined) {
    return next();
  }

  delete query.created_at;

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return next(
      new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "El filtro created_at debe usar $gte y/o $lte"
      )
    );
  }

  try {
    const filter: CreatedAtFilter = {};

    if (raw.$gte !== undefined) {
      filter.$gte = parseDate(raw.$gte, false);
    }
    if (raw.$lte !== undefined) {
      filter.$lte = parseDate(raw.$lte, true);
    }

    if (filter.$gte || filter.$lte) {
      (req as RequestWithCreatedAt).__createdAtFilter = filter;
    }

    next();
  } catch (e) {
    next(e);
  }
};

const applyCreatedAtFilter = (
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const filter = (req as RequestWithCreatedAt).__createdAtFilter;

  if (filter) {
    req.filterableFields = {
      ...(req.filterableFields ?? {}),
      created_at: filter,
    };
  }

  next();
};

export const storeOrdersMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/orders",
    middlewares: [extractCreatedAtFilter],
  },
  {
    method: ["GET"],
    matcher: "/store/orders",
    middlewares: [applyCreatedAtFilter],
  },
];
