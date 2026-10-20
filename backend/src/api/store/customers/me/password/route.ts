import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { IAuthModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { RUT_AUTH_PROVIDER_ID } from "../../../../../modules/rut-auth/config";
import { getRutIdentity } from "../../../../../utils/rut-identity";

/*

Clave del colaborador logueado (rut-auth, paso 6).

GET  → { must_change_password }. El storefront lo consulta al iniciar sesión
       y en los layouts para mandar a /cambiar-clave cuando corresponde.
POST → { current_password, password }. Cambia la clave.

Por qué una ruta propia y no `POST /auth/customer/rut/update` de Medusa: ese
endpoint solo acepta el token del reset por correo (purpose "reset"), no un
token de sesión.

Seguridad del POST:
- La clave actual se verifica ACÁ, contra el provider `rut`. Antes la
  verificaba el storefront con un login aparte, y esta ruta aceptaba
  cualquier clave nueva con solo tener una sesión.
- El RUT sale de la sesión (`auth_context.auth_identity_id`), nunca del
  body: no se puede cambiar la clave de otra cuenta.
- La política de clave la aplica el provider en `update`
  (password-policy.ts), igual que en el reset por correo.

Ambos métodos quedan abiertos aunque el cambio de clave esté pendiente (ver
middlewares/account-state.ts), salvo con la cuenta deshabilitada. `/store/customers/me*` ya exige
sesión de customer en el core de Medusa.

*/

type UpdatePasswordBody = {
  current_password?: unknown;
  password?: unknown;
};

const badRequest = (res: MedusaResponse, code: string, message: string) =>
  res.status(400).json({ type: "invalid_data", code, message });

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const identity = await getRutIdentity(req.scope, req.auth_context?.auth_identity_id);

  if (!identity) {
    return res.status(401).json({ message: "No pudimos identificar tu cuenta." });
  }

  res.json({ must_change_password: identity.state.must_change_password === true });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<UpdatePasswordBody>,
  res: MedusaResponse
) => {
  const { current_password, password } = req.body ?? {};

  if (typeof current_password !== "string" || !current_password) {
    return badRequest(res, "current_password_required", "Ingresa tu clave actual.");
  }

  if (typeof password !== "string") {
    return badRequest(res, "password_required", "Ingresa la clave nueva.");
  }

  const identity = await getRutIdentity(req.scope, req.auth_context?.auth_identity_id);

  if (!identity) {
    return res.status(401).json({ message: "No pudimos identificar tu cuenta." });
  }

  const authModule = req.scope.resolve<IAuthModuleService>(Modules.AUTH);

  const verified = await authModule.authenticate(RUT_AUTH_PROVIDER_ID, {
    body: { rut: identity.rut, password: current_password },
  } as any);

  if (!verified.success) {
    return badRequest(
      res,
      "invalid_current_password",
      "La clave actual no es correcta."
    );
  }

  if (password === current_password) {
    return badRequest(
      res,
      "same_password",
      "La clave nueva debe ser distinta de la actual."
    );
  }

  const { success, error } = await authModule.updateProvider(RUT_AUTH_PROVIDER_ID, {
    entity_id: identity.rut,
    password,
  });

  if (!success) {
    return badRequest(res, "password_policy", error ?? "No se pudo cambiar la clave.");
  }

  res.status(200).json({ success: true });
};
