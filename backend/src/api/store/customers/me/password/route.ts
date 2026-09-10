import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import {
  IAuthModuleService,
  ICustomerModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

type UpdatePasswordBody = {
  password: string;
};

// Cambio de contraseña para un customer YA logueado (ProfileCard →
// "Cambiar contraseña"). Esta ruta existe porque el endpoint nativo de
// Medusa `POST /auth/customer/emailpass/update` NO sirve para este caso:
// ese endpoint pasa por el middleware `validateToken`
// (`@medusajs/medusa/dist/api/auth/utils/validate-token.js`), que exige
// un claim `entity_id` en el JWT — un claim que SOLO trae el token
// especial que arma `generateResetPasswordTokenWorkflow` para el flujo
// de "olvidé mi contraseña". Un token normal de sesión/login (el que ya
// usa el storefront en cada request autenticado) trae `actor_id` +
// `app_metadata`, no `entity_id` — así que ese endpoint SIEMPRE
// responde "Invalid token" con un token de sesión válido, aunque el
// login haya sido correcto (confirmado leyendo el código fuente de
// Medusa v2.8.4).
//
// La forma soportada de resolver esto — documentada como ejemplo en el
// propio tipo `IAuthModuleService.updateProvider`
// (`@medusajs/types/dist/auth/service.d.ts`) — es armar una ruta propia
// protegida por el middleware ESTÁNDAR de autenticación (que sí sabe
// leer un token de sesión normal y llena `req.auth_context.actor_id`
// correctamente) y desde ahí llamar directo al Auth Module Service.
//
// Esta ruta queda protegida gratis: `/store/customers/me*` ya tiene
// `authenticate("customer", ["session", "bearer"])` aplicado a nivel del
// core de Medusa (matcher con wildcard, ver
// `@medusajs/medusa/dist/api/store/customers/middlewares.js`), así que
// no hace falta registrar nada en `src/api/middlewares.ts`.
//
// La verificación de la "contraseña actual" (que el usuario debe
// escribir bien para poder cambiarla) NO pasa por acá — se hace antes,
// del lado del storefront (`changePassword` en
// `storefront/src/lib/data/customer.ts`), con un login real contra el
// provider `emailpass`. Acá se asume que quien llama ya demostró
// conocer la contraseña actual y solo falta aplicar la nueva.
//
// OJO con `entity_id` (bug real, encontrado probando en local):
// `authModuleService.updateProvider("emailpass", { entity_id, ... })`
// NO acepta el id del customer (`cus_...`) como `entity_id` — devuelve
// `AuthIdentity with entity_id "cus_..." not found`. Es porque
// `entity_id` acá es el valor guardado en la tabla `provider_identity`
// del proveedor `emailpass`, que para ese proveedor es el EMAIL, no el
// id del customer. (`req.auth_context.actor_id` sí es el id del
// customer cuando la ruta está protegida por el middleware
// `authenticate` estándar — es un campo con el mismo nombre pero
// distinto significado según qué middleware llenó `auth_context`.) Por
// eso acá se resuelve primero el email del customer autenticado.
//
// Importante por seguridad: ese email se resuelve del lado del
// servidor a partir de `req.auth_context.actor_id` (el customer ya
// autenticado por el middleware), nunca confiando en un email que
// mande el cliente en el body — `updateProvider` no valida que el
// `entity_id` pertenezca a quien está autenticado, así que si se
// confiara en un email del body, cualquier sesión válida podría
// cambiarle la contraseña a CUALQUIER otra cuenta con solo mandar su
// email.
export const POST = async (
  req: AuthenticatedMedusaRequest<UpdatePasswordBody>,
  res: MedusaResponse
) => {
  const { password } = req.body || {};

  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({
      message: "La contraseña debe tener al menos 6 caracteres.",
    });
    return;
  }

  const customerModuleService = req.scope.resolve<ICustomerModuleService>(
    Modules.CUSTOMER
  );

  const customer = await customerModuleService.retrieveCustomer(
    req.auth_context.actor_id
  );

  if (!customer?.email) {
    res.status(401).json({
      message: "No pudimos identificar tu cuenta.",
    });
    return;
  }

  const authModuleService = req.scope.resolve<IAuthModuleService>(
    Modules.AUTH
  );

  const { success, error } = await authModuleService.updateProvider(
    "emailpass",
    {
      password,
      entity_id: customer.email,
    }
  );

  if (!success) {
    res.status(401).json({
      message: error || "No se pudo actualizar la contraseña.",
    });
    return;
  }

  res.status(200).json({ success: true });
};
