import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type {
  IAuthModuleService,
  ICustomerModuleService,
  INotificationModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import { RUT_AUTH_PROVIDER_ID } from "../modules/rut-auth/config"
import { consoleBanner, emailDelivery } from "../utils/email-delivery"
import {
  PASSWORD_RESET_TTL_MINUTES,
  renderPasswordResetEmail,
} from "../utils/email-templates/password-reset"
import { auditAuth, rutRef } from "../utils/auth-audit"
import { maskRut } from "../utils/rut"

/*

Recuperación de contraseña por correo (rut-auth, paso 8).

Escucha `auth.password_reset`, que emite el core de Medusa en
`POST /auth/customer/rut/reset-password` (el storefront lo llama desde
`requestPasswordReset`). El RUT llega normalizado gracias al middleware
reset-password-rut.ts.

El evento trae `{ entity_id, actor_type, token }`:
- entity_id: el RUT normalizado (entity_id de la identidad `rut`), NO un
  correo. El correo se busca: identidad → customer → email.
- Si la cuenta está deshabilitada (paso 9), no se envía nada.
- token: JWT de un solo uso (Medusa lo borra al usarlo) que vence en 15
  minutos (fijo en el core; ver email-templates/password-reset.ts).

Entrega según el ambiente (utils/email-delivery.ts):
- "console" (desarrollo, provider local): se crea la notificación (el
  provider local la escribe en el log) y además el enlace se muestra en un
  recuadro destacado en la consola.
- "send" (provider real, p. ej. Azure Communication Services): se crea la
  notificación con el correo ya armado (asunto, texto y HTML).
- "suppressed" (producción sin provider real): no se crea la notificación y
  el enlace NO aparece en ningún log; solo una advertencia.

Nunca se registra ni se guarda el token fuera del modo "console". El RUT va
enmascarado.

Auditoría (paso 10): auth.reset_enviado o auth.reset_no_enviado (con
motivo), con customer_id y el mismo rut_ref de auth.reset_solicitado (ver
middlewares/reset-password-rut.ts) para unir la solicitud con su resultado.

*/

type PasswordResetEventData = {
  entity_id: string
  actor_type: "customer" | "user"
  token: string
}

/**
 * Customer dueño de la identidad `rut` de ese RUT (con `enabled` de la
 * identidad), o null.
 */
const findCustomerByRut = async (container: MedusaContainer, rut: string) => {
  const authModule = container.resolve<IAuthModuleService>(Modules.AUTH)
  const [providerIdentity] = await authModule.listProviderIdentities({
    provider: RUT_AUTH_PROVIDER_ID,
    entity_id: rut,
  })

  if (!providerIdentity?.auth_identity_id) {
    return null
  }

  const authIdentity = await authModule.retrieveAuthIdentity(
    providerIdentity.auth_identity_id
  )
  const customerId = authIdentity.app_metadata?.customer_id as string | undefined

  if (!customerId) {
    return null
  }

  const customerModule = container.resolve<ICustomerModuleService>(
    Modules.CUSTOMER
  )
  const customer = await customerModule
    .retrieveCustomer(customerId)
    .catch(() => null)

  return customer
    ? { customer, enabled: providerIdentity.provider_metadata?.enabled !== false }
    : null
}

export default async function customerPasswordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetEventData>) {
  // El reset de admin (actor_type "user") no se maneja acá.
  if (data.actor_type !== "customer") {
    return
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const rutMasked = maskRut(data.entity_id)
  const found = await findCustomerByRut(container, data.entity_id)
  const customer = found?.customer

  const audit = {
    customer_id: customer?.id ?? null,
    rut_ref: rutRef(data.entity_id, logger),
  }

  if (!customer?.email) {
    auditAuth(logger, "auth.reset_no_enviado", {
      ...audit,
      motivo: customer ? "sin_correo" : "sin_customer",
    })
    return
  }

  // Cuenta deshabilitada (paso 9): aunque cambiara la clave no podría entrar.
  if (!found?.enabled) {
    auditAuth(logger, "auth.reset_no_enviado", { ...audit, motivo: "cuenta_deshabilitada" })
    return
  }

  const delivery = emailDelivery()

  if (delivery === "suppressed") {
    logger.warn(
      `[password-reset] RUT ${rutMasked}: no hay provider de correo configurado (NOTIFICATION_PROVIDER=local en producción). ` +
        "No se envía el enlace ni se registra en el log."
    )
    auditAuth(logger, "auth.reset_no_enviado", { ...audit, motivo: "correo_no_configurado" })
    return
  }

  // TODO: el país está fijo en "cl" (la tienda solo opera en Chile).
  const storefrontUrl = process.env.STOREFRONT_URL || "http://localhost:8000"
  const resetUrl = `${storefrontUrl}/cl/reset-password?token=${encodeURIComponent(
    data.token
  )}`

  const email = renderPasswordResetEmail({
    firstName: customer.first_name,
    resetUrl,
  })

  const notificationModule = container.resolve<INotificationModuleService>(
    Modules.NOTIFICATION
  )

  await notificationModule.createNotifications([
    {
      to: customer.email,
      channel: "email",
      template: "password-reset",
      // `content` llega al provider pero NO se guarda en la base. `data` sí
      // se guarda en la tabla notification y lo muestra la Admin API
      // (GET /admin/notifications): con un provider real NO puede llevar el
      // enlace, o cualquier admin podría usarlo para entrar a la cuenta.
      // Solo en desarrollo ("console") va el enlace en `data`, para que los
      // tests lo lean.
      content: email,
      data: delivery === "console" ? { reset_url: resetUrl } : {},
    },
  ])

  auditAuth(logger, "auth.reset_enviado", { ...audit, entrega: delivery })

  if (delivery === "console") {
    // El enlace va FUERA del recuadro, en su propia línea y sin bordes:
    // es largo (lleva el JWT) y así se copia completo sin arrastrar "║".
    process.stdout.write(
      consoleBanner("RECUPERACIÓN DE CONTRASEÑA (correo simulado, solo desarrollo)", [
        `Para:    ${customer.email}`,
        `RUT:     ${rutMasked}`,
        `Vence:   en ${PASSWORD_RESET_TTL_MINUTES} minutos, un solo uso`,
        "Enlace:  copia la línea de abajo en el navegador",
      ]) + `${resetUrl}\n\n`
    )
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
