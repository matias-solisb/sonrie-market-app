import {
  computeRutDv,
  initialPasswordFromRut,
  isValidRut,
  maskRut,
  normalizeRut,
} from "../rut";

/*

RUTs de prueba con DV calculado a mano (módulo 11):

- 12.345.678-5   caso típico, 8 dígitos
- 11.111.111-1
- 10.000.013-K   DV K
- 7.654.321-6    7 dígitos
- 6.000.005-0    DV 0

*/

describe("computeRutDv", () => {
  it.each([
    ["12345678", "5"],
    ["11111111", "1"],
    ["10000013", "K"],
    ["7654321", "6"],
    ["6000005", "0"],
  ])("DV de %s es %s", (body, dv) => {
    expect(computeRutDv(body)).toBe(dv);
  });
});

describe("normalizeRut", () => {
  it.each([
    ["12.345.678-5", "12345678-5"],
    ["12345678-5", "12345678-5"],
    ["123456785", "12345678-5"],
    ["  12.345.678 - 5 ", "12345678-5"],
    ["10.000.013-k", "10000013-K"],
    ["10000013k", "10000013-K"],
    ["7.654.321-6", "7654321-6"],
    ["07.654.321-6", "7654321-6"],
  ])("%p → %p", (input, expected) => {
    expect(normalizeRut(input)).toBe(expected);
  });

  it.each([
    ["", "vacío"],
    ["   ", "solo espacios"],
    ["12.345.678-4", "DV incorrecto"],
    ["10.000.013-0", "DV 0 donde corresponde K"],
    ["6.000.005-K", "DV K donde corresponde 0"],
    ["12.345.678-X", "DV con letra que no es K"],
    ["12a45678-5", "letra en el cuerpo"],
    ["1-9", "cuerpo demasiado corto"],
    ["99999-9", "cuerpo de 5 dígitos"],
    ["123456789-2", "cuerpo de 9 dígitos"],
    ["12.345.678--5", "doble guion"],
    ["-5", "sin cuerpo"],
  ])("rechaza %p (%s)", (input) => {
    expect(normalizeRut(input)).toBeNull();
  });

  it("rechaza valores que no son string", () => {
    expect(normalizeRut(undefined as any)).toBeNull();
    expect(normalizeRut(null as any)).toBeNull();
    expect(normalizeRut(12345678 as any)).toBeNull();
  });
});

describe("isValidRut", () => {
  it("acepta un RUT válido en cualquier formato", () => {
    expect(isValidRut("12.345.678-5")).toBe(true);
    expect(isValidRut("10000013k")).toBe(true);
    expect(isValidRut("6.000.005-0")).toBe(true);
  });

  it("rechaza un DV incorrecto", () => {
    expect(isValidRut("12.345.678-4")).toBe(false);
  });
});

describe("initialPasswordFromRut", () => {
  it("son los últimos 4 dígitos del cuerpo, sin el DV", () => {
    expect(initialPasswordFromRut("12.345.678-5")).toBe("5678");
  });

  it("funciona con DV K (la K no entra en la clave)", () => {
    expect(initialPasswordFromRut("10.000.013-K")).toBe("0013");
  });

  it("conserva los ceros a la izquierda de los últimos 4", () => {
    expect(initialPasswordFromRut("6.000.005-0")).toBe("0005");
  });

  it("funciona con RUT de 7 dígitos", () => {
    expect(initialPasswordFromRut("7.654.321-6")).toBe("4321");
  });

  it("lanza error con un RUT inválido", () => {
    expect(() => initialPasswordFromRut("12.345.678-4")).toThrow();
  });
});

describe("maskRut", () => {
  it("deja visibles solo los 2 primeros dígitos y el DV", () => {
    expect(maskRut("12.345.678-5")).toBe("12******-5");
    expect(maskRut("7.654.321-6")).toBe("76*****-6");
    expect(maskRut("10000013k")).toBe("10******-K");
  });

  it("nunca deja visibles los últimos 4 dígitos (son la clave inicial)", () => {
    const masked = maskRut("12.345.678-5");
    expect(masked).not.toContain("5678");
    expect(masked).not.toContain("678");
  });

  it("enmascara por completo un valor que no es un RUT válido", () => {
    expect(maskRut("hola")).toBe("[rut-invalido]");
    expect(maskRut("12.345.678-4")).toBe("[rut-invalido]");
    expect(maskRut(undefined as any)).toBe("[rut-invalido]");
  });
});
