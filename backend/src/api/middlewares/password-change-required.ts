import {
  authenticate,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MiddlewareRoute } from "@medusajs/medusa";
import { getRutIdentity } from "../../utils/rut-identity";

/*

Cambio de clave obligatorio (rut-auth, paso 6).

Mientras la identidad `rut` del colaborador tenga must_change_password =
true (desde el alta hasta que cambia la clave inicial), toda la Store API
responde 403 con code "password_change_required". Quedan abiertas solo:

- GET  /store/customers/me           (el storefront necesita saber quién es)
- GET  /store/customers/me/password  (estado del cambio pendiente)
- POST /store/customers/me/password  (el cambio en sí)

El estado se lee de la base en cada request (una consulta por
auth_identity_id): es la única fuente de verdad, así que el bloqueo se
levanta apenas cambia la clave, sin esperar un token nuevo.

Las requests sin sesión de customer (catálogo público con publishable key,
admin, etc.) pasan sin tocar: el `authenticate` de abajo no exige sesión.

*/

export const PASSWORD_CHANGE_REQUIRED_CODE = "password_change_required";

const ALLOWED: Array<{ method: string; path: string }> = [
  { method: "GET", path: "/store/customers/me" },
  { method: "GET", path: "/store/customers/me/password" },
  { method: "POST", path: "/store/customers/me/password" },
];

const isAllowed = (req: MedusaRequest) => {
  const path = (req.originalUrl ?? req.url).split("?")[0].replace(/\/+$/, "");
  return ALLOWED.some((a) => a.method === req.method && a.path === path);
};

export const requirePasswordChangeDone = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const authContext = (req as any).auth_context;

  if (authContext?.actor_type !== "customer" || isAllowed(req)) {
    return next();
  }

  const identity = await getRutIdentity(req.scope, authContext.auth_identity_id);

  if (identity?.state.must_change_password === true) {
    return res.status(403).json({
      type: "not_allowed",
      code: PASSWORD_CHANGE_REQUIRED_CODE,
      message: "Debes cambiar tu clave antes de continuar.",
    });
  }

  next();
};

export const passwordChangeRequiredMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/*",
    middlewares: [
      authenticate("customer", ["session", "bearer"], {
        allowUnauthenticated: true,
      }),
      requirePasswordChangeDone,
    ],
  },
];
