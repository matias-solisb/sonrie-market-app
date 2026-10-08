/*

Fechas de retiro ("YYYY-MM-DD", metadata.pickup_date del carrito y del
pedido) en español.

Son fechas de calendario de Chile, no instantes: se interpretan a mediodía
UTC y se formatean en UTC, así el día no se corre por la zona horaria del
navegador o del servidor.

*/
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

const toDate = (fecha: string) => new Date(`${fecha}T12:00:00Z`)

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const isPickupDate = (value: unknown): value is string =>
  typeof value === "string" && FECHA_RE.test(value)

/** "2026-10-08" → "jueves 8 de octubre" */
export function formatPickupDate(fecha: string): string {
  if (!isPickupDate(fecha)) return fecha

  // Se arma a mano: Intl en es-CL pone una coma después del día de la
  // semana ("jueves, 8 de octubre").
  const parts = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).formatToParts(toDate(fecha))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""

  return `${get("weekday")} ${get("day")} de ${get("month")}`
}

/** "2026-10-08" → { weekday: "Jue", day: "8", month: "oct" } (para el selector) */
export function pickupDateParts(fecha: string) {
  const date = toDate(fecha)
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-CL", { ...options, timeZone: "UTC" })
      .format(date)
      .replace(".", "")

  return {
    weekday: capitalize(part({ weekday: "short" })),
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
  }
}
