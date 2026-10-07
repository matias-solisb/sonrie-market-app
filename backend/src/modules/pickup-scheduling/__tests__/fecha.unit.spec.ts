import {
  addDays,
  diaSemana,
  diffDays,
  eachFecha,
  formatFecha,
  isValidFecha,
  toFecha,
} from "../utils/fecha";

describe("utils/fecha", () => {
  describe("toFecha (hora de Santiago)", () => {
    it("en horario de verano (UTC-3) cambia de día a las 03:00 UTC", () => {
      expect(toFecha(new Date("2026-10-08T02:59:59Z"))).toBe("2026-10-07");
      expect(toFecha(new Date("2026-10-08T03:00:00Z"))).toBe("2026-10-08");
    });

    it("en horario de invierno (UTC-4) cambia de día a las 04:00 UTC", () => {
      expect(toFecha(new Date("2026-07-01T03:59:59Z"))).toBe("2026-06-30");
      expect(toFecha(new Date("2026-07-01T04:00:00Z"))).toBe("2026-07-01");
    });

    it("rechaza una fecha inválida", () => {
      expect(() => toFecha(new Date("x"))).toThrow("fecha inválida");
    });
  });

  describe("isValidFecha", () => {
    it.each(["2026-10-07", "2028-02-29"])("acepta %s", (f) => {
      expect(isValidFecha(f)).toBe(true);
    });

    it.each(["2026-02-30", "2027-02-29", "2026-13-01", "2026-1-07", "07-10-2026", "", null, 20261007])(
      "rechaza %p",
      (f) => {
        expect(isValidFecha(f)).toBe(false);
      }
    );
  });

  describe("addDays / diffDays / eachFecha", () => {
    it("cruza mes y año", () => {
      expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
      expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
      expect(addDays("2026-10-07", 14)).toBe("2026-10-21");
    });

    it("no se corre en los cambios de horario de Chile", () => {
      // Chile vuelve a UTC-4 el primer domingo de abril y a UTC-3 el primero de septiembre.
      expect(addDays("2027-04-03", 1)).toBe("2027-04-04");
      expect(addDays("2027-04-04", 1)).toBe("2027-04-05");
      expect(addDays("2026-09-05", 1)).toBe("2026-09-06");
      expect(addDays("2026-09-06", 1)).toBe("2026-09-07");
    });

    it("diffDays", () => {
      expect(diffDays("2026-10-07", "2026-10-21")).toBe(14);
      expect(diffDays("2026-12-31", "2027-01-01")).toBe(1);
      expect(diffDays("2026-10-08", "2026-10-07")).toBe(-1);
    });

    it("eachFecha incluye ambos extremos", () => {
      expect(eachFecha("2026-12-30", "2027-01-02")).toEqual([
        "2026-12-30",
        "2026-12-31",
        "2027-01-01",
        "2027-01-02",
      ]);
      expect(eachFecha("2026-10-08", "2026-10-08")).toEqual(["2026-10-08"]);
    });
  });

  describe("diaSemana (ISO)", () => {
    it.each([
      ["2026-10-05", 1],
      ["2026-10-07", 3],
      ["2026-10-10", 6],
      ["2026-10-11", 7],
      ["2027-01-01", 5],
    ])("%s → %i", (fecha, dia) => {
      expect(diaSemana(fecha)).toBe(dia);
    });
  });

  it("formatFecha", () => {
    expect(formatFecha("2026-10-12")).toBe("12-10-2026");
  });
});
