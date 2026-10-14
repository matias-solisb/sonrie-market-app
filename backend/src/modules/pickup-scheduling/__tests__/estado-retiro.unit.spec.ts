import { estadoRetiro } from "../utils/estado-retiro";

describe("utils/estado-retiro", () => {
  const HOY = "2026-10-14";

  it("agendado: futuro, hoy o ya pasado", () => {
    expect(estadoRetiro({ estado: "agendado", fecha: "2026-10-15" }, HOY)).toBe("agendado");
    expect(estadoRetiro({ estado: "agendado", fecha: HOY }, HOY)).toBe("retira_hoy");
    expect(estadoRetiro({ estado: "agendado", fecha: "2026-10-13" }, HOY)).toBe("no_retirado");
  });

  it("los demás estados no dependen de la fecha", () => {
    for (const estado of ["pendiente", "retirado", "anulado"] as const) {
      expect(estadoRetiro({ estado, fecha: "2026-10-01" }, HOY)).toBe(estado);
      expect(estadoRetiro({ estado, fecha: "2026-10-30" }, HOY)).toBe(estado);
    }
  });
});
