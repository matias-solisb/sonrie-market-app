import { isVigente } from "../utils/vigencia";

describe("isVigente", () => {
  const ahora = new Date("2026-10-29T15:00:00Z");

  it("sin fechas siempre está vigente", () => {
    expect(isVigente({}, ahora)).toBe(true);
    expect(isVigente({ fecha_inicio: null, fecha_fin: null }, ahora)).toBe(
      true
    );
  });

  it("no se muestra antes del inicio", () => {
    expect(
      isVigente({ fecha_inicio: "2026-10-29T15:00:01Z" }, ahora)
    ).toBe(false);
  });

  it("el inicio es inclusivo", () => {
    expect(isVigente({ fecha_inicio: "2026-10-29T15:00:00Z" }, ahora)).toBe(
      true
    );
  });

  it("el fin es exclusivo", () => {
    expect(isVigente({ fecha_fin: "2026-10-29T15:00:00Z" }, ahora)).toBe(
      false
    );
    expect(isVigente({ fecha_fin: "2026-10-29T15:00:01Z" }, ahora)).toBe(
      true
    );
  });

  it("dentro del rango está vigente", () => {
    expect(
      isVigente(
        {
          fecha_inicio: new Date("2026-10-01T00:00:00Z"),
          fecha_fin: new Date("2026-11-01T00:00:00Z"),
        },
        ahora
      )
    ).toBe(true);
  });

  it("ignora fechas inválidas (las trata como sin límite)", () => {
    expect(isVigente({ fecha_inicio: "no-es-fecha" }, ahora)).toBe(true);
  });
});
