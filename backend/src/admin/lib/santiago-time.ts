/*

Conversión entre la hora de Chile (lo que el admin escribe en un
<input type="datetime-local">) y un instante UTC (lo que guarda el
backend). Considera el cambio de horario (UTC-3 / UTC-4) usando Intl,
sin dependencias.

*/
const TZ = "America/Santiago";

const partsIn = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
};

const pad = (value: number) => String(value).padStart(2, "0");

/** ISO UTC → "YYYY-MM-DDTHH:mm" en hora de Chile ("" si no hay fecha). */
export const isoToSantiagoInput = (iso: string | null | undefined): string => {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const p = partsIn(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(
    p.minute
  )}`;
};

/** "YYYY-MM-DDTHH:mm" en hora de Chile → ISO UTC (null si está vacío). */
export const santiagoInputToIso = (value: string): string | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const [, y, mo, d, h, mi] = match.map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);

  // Se parte suponiendo que la hora escrita es UTC y se corrige por el
  // desfase de Santiago en ese instante; una segunda pasada ajusta los
  // casos que caen justo en el cambio de horario.
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = partsIn(new Date(guess));
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wanted - shown;
  }
  return new Date(guess).toISOString();
};

/** Fecha legible en hora de Chile, ej. "29-10-2026 12:00". */
export const formatSantiago = (iso: string | null | undefined): string => {
  if (!iso) {
    return "";
  }
  const p = partsIn(new Date(iso));
  return `${pad(p.day)}-${pad(p.month)}-${p.year} ${pad(p.hour)}:${pad(
    p.minute
  )}`;
};
