import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { defineMiddlewares } from "@medusajs/medusa";
import { adminMiddlewares } from "./admin/middlewares";
import { quotesDisabledMiddlewares } from "./middlewares/quotes-disabled";
import { selfSignupDisabledMiddlewares } from "./middlewares/self-signup-disabled";
import { adminInviteEmailMiddlewares } from "./middlewares/admin-invite-email";
import { passwordChangeRequiredMiddlewares } from "./middlewares/password-change-required";
import { resetPasswordRutMiddlewares } from "./middlewares/reset-password-rut";
import { storeMiddlewares } from "./store/middlewares";

export default defineMiddlewares({
  routes: [
    // Primero: apaga /store/quotes y /admin/quotes (ver quotes-disabled.ts)
    ...quotesDisabledMiddlewares,
    // Sin autorregistro de clientes (ver self-signup-disabled.ts)
    ...selfSignupDisabledMiddlewares,
    // Correo válido en las invitaciones del Admin (ver admin-invite-email.ts)
    ...adminInviteEmailMiddlewares,
    // Recuperación de contraseña: RUT normalizado (rut-auth, paso 8)
    ...resetPasswordRutMiddlewares,
    // Cambio de clave obligatorio antes de usar la tienda (rut-auth, paso 6)
    ...passwordChangeRequiredMiddlewares,
    ...adminMiddlewares,
    ...storeMiddlewares,
    {
      matcher: "/store/customers/me",
      middlewares: [
        (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
          req.allowed = ["employee"];
          next();
        },
      ],
    },
  ],
});
