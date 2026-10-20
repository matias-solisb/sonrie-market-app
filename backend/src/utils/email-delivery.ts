/*

Cómo se entregan los correos según el ambiente (rut-auth, paso 8).

NOTIFICATION_PROVIDER elige el provider de correo del Notification Module
(ver medusa-config.ts):

- "local" (por defecto): no envía nada. El Notification Module escribe el
  contenido en el log y, en desarrollo, el subscriber además muestra el
  enlace destacado en la consola.
- "acs" (pendiente, tarea 5.3 de infra): Azure Communication Services Email.
  Para activarlo: agregar el provider en src/modules/notification-acs,
  registrarlo en medusa-config.ts y definir NOTIFICATION_PROVIDER=acs y sus
  secretos en Key Vault. Los subscribers no cambian.

Regla de seguridad: con el provider "local" en producción NO se genera la
notificación. El enlace de recuperación lleva un token que da acceso a la
cuenta; en la nube los logs del contenedor llegan a Log Analytics, y ahí no
pueden quedar tokens (paso 10). En ese caso solo se registra una advertencia.

*/

export type EmailDelivery =
  /** Provider real: se envía el correo. */
  | "send"
  /** Desarrollo con provider local: se "envía" al log y se destaca el enlace. */
  | "console"
  /** Producción sin provider real: no se envía nada ni se registra el enlace. */
  | "suppressed";

export const emailProviderId = (env: NodeJS.ProcessEnv = process.env) =>
  (env.NOTIFICATION_PROVIDER || "local").trim().toLowerCase();

export const emailDelivery = (
  env: NodeJS.ProcessEnv = process.env
): EmailDelivery => {
  if (emailProviderId(env) !== "local") {
    return "send";
  }

  return env.NODE_ENV === "production" ? "suppressed" : "console";
};

/**
 * Recuadro para la consola de desarrollo. Va directo a stdout (no al logger)
 * para que se vea aunque el log esté lleno de otras líneas.
 */
export const consoleBanner = (title: string, lines: string[]) => {
  const width = Math.max(title.length, ...lines.map((l) => l.length)) + 4;
  const bar = "═".repeat(width);
  const row = (text: string) => `║  ${text.padEnd(width - 4)}  ║`;

  return [
    "",
    `╔${bar}╗`,
    row(title),
    `╠${bar}╣`,
    ...lines.map(row),
    `╚${bar}╝`,
    "",
  ].join("\n");
};
