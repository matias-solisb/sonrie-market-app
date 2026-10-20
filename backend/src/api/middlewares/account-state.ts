import {
  authenticate,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MiddlewareRoute } from "@medusajs/medusa";
import { getRutIdentity } from "../../utils/rut-identity";

/*

Estado de la cuenta en cada request de la Store API (rut-auth, pasos 6 y 9).

1. Cuenta DESHABILITADA (paso 9): toda la Store API responde 401 con code
   "account_disabled", sin excepciones. Corta las sesiones abiertas en el
   siguiente request, sin esperar a que venza el JWT. El storefront borra la
   cookie y manda al login con un aviso.

2. Cambio de clave obligatorio (paso 6): mientras la identidad `rut` del colaborador tenga must_change_password =
true (desde el alta hasta que cambia la clave inicial), toda la Store API
responde 403 con code "password_change_required". Quedan abiertas solo:

- GET  /store/customers/me           (el storefront necesita saber quién es)
- GET  /store/customers/me/password  (estado del cambio pendiente)
- POST /store/customers/me/password  (el cambio en sí)

El estado se lee de la base en cada request (una sola consulta por
auth_identity_id para ambos chequeos): es la única fuente de verdad, así que
deshabilitar corta el acceso al instante y cambiar la clave lo devuelve sin
esperar un token nuevo.

Las requests sin sesión de customer (catálogo público con publishable key,
admin, etc.) pasan sin tocar: el `authenticate` de abajo no exige sesión.

*/

export const PASSWORD_CHANGE_REQUIRED_CODE = "password_change_required";
export const ACCOUNT_DISABLED_CODE = "account_disabled";

const ALLOWED: Array<{ method: string; path: string }> = [
  { method: "GET", path: "/store/customers/me" },
  { method: "GET", path: "/store/customers/me/password" },
  { method: "POST", path: "/store/customers/me/password" },
];

const isAllowed = (req: MedusaRequest) => {
  const path = (req.originalUrl ?? req.url).split("?")[0].replace(/\/+$/, "");
  return ALLOWED.some((a) => a.method === req.method && a.path === path);
};

export const enforceAccountState = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const authContext = (req as any).auth_context;

  if (authContext?.actor_type !== "customer") {
    return next();
  }

  const identity = await getRutIdentity(req.scope, authContext.auth_identity_id);

  if (identity?.state.enabled === false) {
    return res.status(401).json({
      type: "unauthorized",
      code: ACCOUNT_DISABLED_CODE,
      message: "Tu cuenta está deshabilitada.",
    });
  }

  if (isAllowed(req)) {
    return next();
  }

  if (identity?.state.must_change_password === true) {
    return res.status(403).json({
      type: "not_allowed",
      code: PASSWORD_CHANGE_REQUIRED_CODE,
      message: "Debes cambiar tu clave antes de continuar.",
    });
  }

  next();
};

export const accountStateMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/*",
    middlewares: [
      authenticate("customer", ["session", "bearer"], {
        allowUnauthenticated: true,
      }),
      enforceAccountState,
    ],
  },
];
