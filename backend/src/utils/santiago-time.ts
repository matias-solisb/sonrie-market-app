/*

Límites de un día de calendario en hora de Chile continental
(America/Santiago), como instantes UTC.

Sirve para filtros por fecha que el colaborador elige en el storefront
("Fecha desde / hasta" en Mis pedidos): "6 de octubre" significa el 6 de
octubre en Chile, no en UTC. Un pedido del 6-oct a las 22:30 en Santiago
(01:30 UTC del 7-oct) pertenece al 6.

No depende de la variable de entorno `TZ` del proceso: la zona va explícita
en `Intl.DateTimeFormat` (mismo criterio que modules/benefit-budget/utils/period.ts).

Cambio de horario: en Chile el cambio ocurre a la medianoche, así que hay
días cuya medianoche no existe (septiembre: de 23:59 se pasa a 01:00). El
inicio del día es entonces el primer instante que en Santiago ya es ese día.

*/
export const SANTIAGO_TIMEZONE = "America/Santiago";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const HOUR = 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SANTIAGO_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" del instante en hora de Santiago. */
export const santiagoDate = (instant: Date): string =>
  dateFormatter.format(instant);

const parseDateOnly = (date: string) => {
  const m = DATE_ONLY.exec(date);
  const parsed = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));

  if (!m || !parsed || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Fecha inválida: ${date}. Formato esperado: YYYY-MM-DD.`);
  }

  return parsed;
};

/** Primer instante (UTC) del día `YYYY-MM-DD` en Santiago. */
export const startOfSantiagoDay = (date: string): Date => {
  const utcMidnight = parseDateOnly(date).getTime();

  // Los desfases de Chile son horas enteras: se prueba hora a hora y se
  // queda con el primer instante que en Santiago ya es `date`.
  for (let h = -14; h <= 14; h++) {
    const candidate = new Date(utcMidnight + h * HOUR);
    if (santiagoDate(candidate) === date) {
      return candidate;
    }
  }

  throw new Error(`No se pudo calcular el inicio del día ${date} en Santiago.`);
};

/** Último milisegundo (UTC) del día `YYYY-MM-DD` en Santiago. */
export const endOfSantiagoDay = (date: string): Date => {
  const next = new Date(parseDateOnly(date).getTime() + 24 * HOUR)
    .toISOString()
    .slice(0, 10);

  return new Date(startOfSantiagoDay(next).getTime() - 1);
};
