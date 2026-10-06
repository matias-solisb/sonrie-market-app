import { getPeriod, isValidPeriod, nextPeriod } from "../utils/period";

describe("getPeriod (America/Santiago)", () => {
  it("usa el mes de Santiago aunque en UTC ya sea el mes siguiente", () => {
    // 31-oct 22:30 en Chile (UTC-3) = 1-nov 01:30 UTC
    expect(getPeriod(new Date("2026-11-01T01:30:00Z"))).toBe("2026-10");
  });

  it("cambia de mes justo a la medianoche de Santiago", () => {
    // 1-nov 00:00 en Chile (UTC-3) = 1-nov 03:00 UTC
    expect(getPeriod(new Date("2026-11-01T02:59:59Z"))).toBe("2026-10");
    expect(getPeriod(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11");
  });

  it("respeta el horario de invierno (UTC-4)", () => {
    // 1-jul 00:00 en Chile (UTC-4) = 1-jul 04:00 UTC
    expect(getPeriod(new Date("2026-07-01T03:59:59Z"))).toBe("2026-06");
    expect(getPeriod(new Date("2026-07-01T04:00:00Z"))).toBe("2026-07");
  });

  it("cruza el año", () => {
    expect(getPeriod(new Date("2027-01-01T02:00:00Z"))).toBe("2026-12");
    expect(getPeriod(new Date("2027-01-01T03:00:00Z"))).toBe("2027-01");
  });

  it("rechaza fechas inválidas", () => {
    expect(() => getPeriod(new Date("no-es-fecha"))).toThrow();
  });
});

describe("isValidPeriod", () => {
  it("acepta YYYY-MM y rechaza lo demás", () => {
    expect(isValidPeriod("2026-10")).toBe(true);
    expect(isValidPeriod("2026-13")).toBe(false);
    expect(isValidPeriod("2026-1")).toBe(false);
    expect(isValidPeriod("10-2026")).toBe(false);
  });
});

describe("nextPeriod", () => {
  it("avanza un mes y cruza el año", () => {
    expect(nextPeriod("2026-10")).toBe("2026-11");
    expect(nextPeriod("2026-12")).toBe("2027-01");
  });

  it("rechaza periodos inválidos", () => {
    expect(() => nextPeriod("2026-13")).toThrow("periodo inválido");
  });
});
