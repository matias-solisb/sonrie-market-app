/*

Periodo del beneficio ("YYYY-MM") en hora de Chile continental.

El corte de mes del beneficio es la medianoche de Santiago, no la de UTC:
una compra del 31 de octubre a las 22:30 en Chile (01:30 UTC del 1 de
noviembre) pertenece a octubre.

No depende de la variable de entorno `TZ` del proceso: la zona va explícita
en `Intl.DateTimeFormat`, así el resultado es el mismo en el backend, en el
worker y en los tests. En la BD las fechas siguen en UTC.

*/
export const BENEFIT_TIMEZONE = "America/Santiago";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BENEFIT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
});

export function getPeriod(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("getPeriod: fecha inválida");
  }

  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;

  return `${year}-${month}`;
}

export function isValidPeriod(periodo: string): boolean {
  return PERIOD_RE.test(periodo);
}
