import {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { authenticate, MiddlewareRoute } from "@medusajs/medusa";
import {
  endOfSantiagoDay,
  startOfSantiagoDay,
} from "../../../utils/santiago-time";

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

Una fecha sola (sin hora) es un día de calendario en hora de Santiago
(src/utils/santiago-time.ts): `$gte` desde el inicio de ese día y `$lte`
hasta su final, así "Fecha hasta" incluye los pedidos de ese mismo día y un
pedido de las 22:30 en Chile no se corre al día siguiente por estar en UTC.

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
    try {
      return (
        endOfDay ? endOfSantiagoDay(value) : startOfSantiagoDay(value)
      ).toISOString();
    } catch {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Fecha inválida en el filtro created_at: ${value}`
      );
    }
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

/*

Detalle de pedido (endpoint CORE `GET /store/orders/:id`): solo para su dueño.

En el core de Medusa esa ruta no exige sesión (sirve para la confirmación de
compras de invitados): basta el id del pedido para leer nombre, correo e
ítems. En Sonríe Market todo pedido es de un colaborador logueado, así que se
exige sesión y que el pedido sea suyo; si no, 404 (no se revela si existe).
El storefront ya envía la sesión (lib/data/orders.ts → retrieveOrder).

*/
const ORDER_DETAIL_PATH = /^\/store\/orders\/[^/]+\/?$/;

const ensureOrderOwner = async (
  req: AuthenticatedMedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) => {
  if (!ORDER_DETAIL_PATH.test(req.originalUrl.split("?")[0])) {
    return next();
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id"],
      filters: { id: req.params.id },
    });

    if (!order || order.customer_id !== req.auth_context?.actor_id) {
      return next(
        new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Order with id: ${req.params.id} was not found`
        )
      );
    }

    next();
  } catch (e) {
    next(e);
  }
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
  {
    method: ["GET"],
    matcher: "/store/orders/:id",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
      ensureOrderOwner,
    ],
  },
];
