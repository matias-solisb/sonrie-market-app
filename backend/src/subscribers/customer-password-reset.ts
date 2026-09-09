import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import type { INotificationModuleService } from "@medusajs/framework/types"

/*

Escucha el evento `auth.password_reset`, que el core de Medusa emite
automáticamente cada vez que se llama
`POST /auth/{actor_type}/{provider}/reset-password` (ver
`generateResetPasswordTokenWorkflow` en `@medusajs/core-flows` — no hay
que llamarlo a mano, ya viene disparado por ese endpoint). El storefront
llama a ese endpoint desde el server action `requestPasswordReset`
(`storefront/src/lib/data/customer.ts`), que a su vez usa
`sdk.auth.resetPassword("customer", "emailpass", { identifier: email })`.

El evento trae `{ entity_id, actor_type, token }`:
- `entity_id`: el email de la cuenta (customer o admin user, según
  `actor_type`) — Medusa reutiliza el mismo evento para ambos actores.
- `actor_type`: "customer" | "user" — acá solo nos interesa "customer"
  (el reset de admin, si algún día se usa, tendría su propio subscriber
  o lógica separada).
- `token`: JWT firmado, vence en 15 minutos (hardcodeado así en el core,
  no es configurable desde acá).

Este subscriber arma el link de reset (storefront + token) y lo manda a
través del módulo de notificaciones (`Modules.NOTIFICATION`, registrado
en `medusa-config.ts`). Por ahora ese módulo solo tiene el provider
`local`, que NO manda correos reales — solo hace `logger.info(...)` con
el link en la terminal del backend. Así se puede probar el flujo
completo (pedir reset → copiar el link de la consola → poner contraseña
nueva) sin depender de ningún servicio de correo todavía.

Lo que falta para producción (ver medusa-config.ts):
1. Reemplazar el provider `local` por uno real (SendGrid/Resend/SMTP)
   con sus credenciales en `.env`.
2. Una plantilla de correo de verdad — hoy `template: "password-reset"`
   es solo un identificador, el provider local lo ignora por completo.

*/

type PasswordResetEventData = {
  entity_id: string
  actor_type: "customer" | "user"
  token: string
}

export default async function customerPasswordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetEventData>) {
  // El reset de admin (actor_type "user") no nos interesa acá — este
  // storefront solo tiene login de customer.
  if (data.actor_type !== "customer") {
    return
  }

  const notificationModuleService: INotificationModuleService =
    container.resolve(Modules.NOTIFICATION)

  // TODO: el país está hardcodeado a "cl" — el sitio hoy solo opera en
  // Chile (ver STORE_CORS / check-env-variables). Si en algún momento se
  // agrega otro país, este link necesita saber cuál usar en vez de
  // asumirlo.
  const storefrontUrl = process.env.STOREFRONT_URL || "http://localhost:8000"
  const resetUrl = `${storefrontUrl}/cl/reset-password?token=${encodeURIComponent(
    data.token
  )}`

  // `createNotifications` recibe un arreglo (se puede mandar más de una
  // notificación de una), aunque acá siempre mandamos una sola.
  await notificationModuleService.createNotifications([
    {
      to: data.entity_id,
      channel: "email",
      template: "password-reset",
      data: {
        email: data.entity_id,
        reset_url: resetUrl,
      },
    },
  ])
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
