/**
 * Ruta que borra la cookie de sesión y manda al login con un aviso
 * (app/api/sesion-cerrada/route.ts, rut-auth paso 9).
 *
 * Vive fuera de lib/data/customer.ts porque ese archivo es "use server": ahí
 * solo pueden exportarse funciones async (server actions).
 */
export const sessionClosedUrl = (countryCode: string) =>
  `/api/sesion-cerrada?country=${encodeURIComponent(countryCode)}`
