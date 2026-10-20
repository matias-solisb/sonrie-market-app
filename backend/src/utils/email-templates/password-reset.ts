/*

Correo de recuperación de contraseña (rut-auth, paso 8).

El contenido se arma acá y no en el provider de notificaciones: el provider
solo entrega lo que recibe. Así, al pasar de `local` (consola) a Azure
Communication Services, el correo es el mismo y no se toca este archivo ni
el subscriber.

Vigencia del enlace: 15 minutos, fija en el core de Medusa 2.21
(RESET_PASSWORD_TOKEN_TTL_SECONDS en generateResetPasswordTokenWorkflow).
Decisión del proyecto: se acepta tal cual. Cambiarla obliga a reemplazar la
ruta y el workflow del core.

*/

export const PASSWORD_RESET_TTL_MINUTES = 15;

export type PasswordResetEmailInput = {
  firstName?: string | null;
  resetUrl: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const renderPasswordResetEmail = ({
  firstName,
  resetUrl,
}: PasswordResetEmailInput) => {
  const saludo = firstName?.trim() ? `Hola ${firstName.trim()}:` : "Hola:";
  const subject = "Sonríe Market: recupera tu contraseña";

  const text = [
    saludo,
    "",
    "Recibimos una solicitud para cambiar la contraseña de tu cuenta de Sonríe Market.",
    "Para definir una nueva, abre este enlace:",
    "",
    resetUrl,
    "",
    `El enlace sirve una sola vez y vence en ${PASSWORD_RESET_TTL_MINUTES} minutos.`,
    "Si no lo pediste tú, ignora este correo: tu contraseña no cambia.",
  ].join("\n");

  const url = escapeHtml(resetUrl);
  const html = `<!doctype html>
<html lang="es">
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
    <p>${escapeHtml(saludo)}</p>
    <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de Sonríe Market.</p>
    <p>
      <a href="${url}" style="display: inline-block; padding: 10px 18px; background: #e11d48; color: #ffffff; text-decoration: none; border-radius: 6px;">
        Definir una contraseña nueva
      </a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      El enlace sirve una sola vez y vence en ${PASSWORD_RESET_TTL_MINUTES} minutos.<br />
      Si no lo pediste tú, ignora este correo: tu contraseña no cambia.
    </p>
  </body>
</html>`;

  return { subject, text, html };
};
