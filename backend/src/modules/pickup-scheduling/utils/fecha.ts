/*

Fechas de retiro ("YYYY-MM-DD") en hora de Chile continental.

Un día de retiro es una fecha de calendario, no un instante: se guarda como
texto y se compara como texto (el formato ISO ordena bien). Así no se
"corre" un día al pasar por UTC.

"Hoy" se calcula con la zona explícita en `Intl.DateTimeFormat`, no con la
variable `TZ` del proceso: el resultado es el mismo en backend, worker y
tests (mismo criterio que benefit-budget/utils/period.ts).

La aritmética de días (sumar, día de la semana) se hace sobre la fecha de
calendario en UTC a mediodía, donde no hay cambios de horario.

*/
export const PICKUP_TIMEZONE = "America/Santiago";

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DIA = 24 * 60 * 60 * 1000;

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PICKUP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de calendario en Santiago del instante `date` (por defecto, ahora). */
export function toFecha(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("toFecha: fecha inválida");
  }

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** true si es "YYYY-MM-DD" y la fecha existe (rechaza 2026-02-30). */
export function isValidFecha(fecha: unknown): fecha is string {
  if (typeof fecha !== "string") {
    return false;
  }

  const match = FECHA_RE.exec(fecha);

  if (!match) {
    return false;
  }

  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));

  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function toUtcNoon(fecha: string): Date {
  if (!isValidFecha(fecha)) {
    throw new Error(`Fecha inválida: ${fecha}. Formato esperado: YYYY-MM-DD.`);
  }

  const [y, m, d] = fecha.split("-").map(Number);

  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** Suma (o resta) días: addDays("2026-12-31", 1) → "2027-01-01". */
export function addDays(fecha: string, dias: number): string {
  const date = toUtcNoon(fecha);
  date.setUTCDate(date.getUTCDate() + dias);

  return date.toISOString().slice(0, 10);
}

/** Día de la semana ISO: lunes = 1 … domingo = 7. */
export function diaSemana(fecha: string): number {
  const day = toUtcNoon(fecha).getUTCDay();

  return day === 0 ? 7 : day;
}

/** Días desde `desde` hasta `hasta` (negativo si `hasta` es anterior). */
export function diffDays(desde: string, hasta: string): number {
  return Math.round(
    (toUtcNoon(hasta).getTime() - toUtcNoon(desde).getTime()) / MS_DIA
  );
}

/** Todas las fechas entre `desde` y `hasta`, ambas incluidas. */
export function eachFecha(desde: string, hasta: string): string[] {
  const total = diffDays(desde, hasta);
  const fechas: string[] = [];

  for (let i = 0; i <= total; i++) {
    fechas.push(addDays(desde, i));
  }

  return fechas;
}

/** "2026-10-12" → "12-10-2026", para mensajes al colaborador. */
export function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-");

  return `${d}-${m}-${y}`;
}
