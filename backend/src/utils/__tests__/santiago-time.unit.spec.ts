import {
  endOfSantiagoDay,
  santiagoDate,
  startOfSantiagoDay,
} from "../santiago-time";

describe("días de calendario en hora de Santiago", () => {
  it("horario de verano (UTC-3)", () => {
    expect(startOfSantiagoDay("2026-10-06").toISOString()).toBe(
      "2026-10-06T03:00:00.000Z"
    );
    expect(endOfSantiagoDay("2026-10-06").toISOString()).toBe(
      "2026-10-07T02:59:59.999Z"
    );
  });

  it("horario de invierno (UTC-4)", () => {
    expect(startOfSantiagoDay("2026-06-15").toISOString()).toBe(
      "2026-06-15T04:00:00.000Z"
    );
    expect(endOfSantiagoDay("2026-06-15").toISOString()).toBe(
      "2026-06-16T03:59:59.999Z"
    );
  });

  it("día del cambio a verano: la medianoche no existe, el día parte a la 01:00", () => {
    // 6-sep-2026: de 23:59 (UTC-4) se pasa a 01:00 (UTC-3)
    expect(startOfSantiagoDay("2026-09-06").toISOString()).toBe(
      "2026-09-06T04:00:00.000Z"
    );
    expect(endOfSantiagoDay("2026-09-05").toISOString()).toBe(
      "2026-09-06T03:59:59.999Z"
    );
  });

  it("día del cambio a invierno: el sábado dura 25 horas", () => {
    // 4-abr-2026 a las 24:00 (UTC-3) se vuelve a 23:00 (UTC-4)
    expect(startOfSantiagoDay("2026-04-04").toISOString()).toBe(
      "2026-04-04T03:00:00.000Z"
    );
    expect(endOfSantiagoDay("2026-04-04").toISOString()).toBe(
      "2026-04-05T03:59:59.999Z"
    );
  });

  it("un pedido de las 22:30 en Santiago cae en ese día, no en el siguiente", () => {
    const pedido = new Date("2026-10-07T01:30:00Z");
    expect(santiagoDate(pedido)).toBe("2026-10-06");
    expect(pedido >= startOfSantiagoDay("2026-10-06")).toBe(true);
    expect(pedido <= endOfSantiagoDay("2026-10-06")).toBe(true);
  });

  it("rechaza fechas inválidas", () => {
    for (const d of ["2026-13-01", "2026-02-30", "06-10-2026", "hoy"]) {
      expect(() => startOfSantiagoDay(d)).toThrow("Fecha inválida");
    }
  });
});
