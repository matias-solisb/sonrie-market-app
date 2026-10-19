/*

Validación de correos compartida por el alta de colaboradores
(workflows/colaborador) y las invitaciones del Admin
(api/middlewares/admin-invite-email.ts).

Formato mínimo: algo@algo.dominio, sin espacios. No intenta cubrir todo el
RFC 5322: su objetivo es atajar los errores de tipeo comunes ("juana@",
"juana.perez", "juana perez@…") antes de crear una cuenta o una invitación.

*/

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Recorta espacios y pasa a minúsculas. */
export const normalizeEmail = (email: string | null | undefined) =>
  (email ?? "").trim().toLowerCase();

/** true si el correo (ya normalizado) tiene un formato válido. */
export const isValidEmail = (email: string | null | undefined) =>
  EMAIL_RE.test(email ?? "");
