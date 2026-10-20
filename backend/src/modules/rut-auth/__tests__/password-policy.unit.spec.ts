import { PASSWORD_POLICY } from "../config";
import { checkNewPassword } from "../password-policy";

/*

Política de clave nueva (rut-auth, paso 6). RUT de prueba: 12.345.678-5,
clave inicial "5678". Tramos de 4 dígitos del cuerpo: 1234, 2345, 3456,
4567, 5678.

*/

const RUT = "12345678-5";

describe("checkNewPassword", () => {
  it.each([
    "ClaveSegura2026",
    "otra-clave-larga",
    "1357 Soprole",
    "a".repeat(PASSWORD_POLICY.maxLength),
  ])("acepta %p", (password) => {
    expect(checkNewPassword(RUT, password)).toBeNull();
  });

  it.each([
    ["vacía", ""],
    ["no es texto", undefined],
    ["corta", "Abc123"],
    ["la clave inicial", "5678"],
  ])("rechaza una clave %s por largo", (_caso, password) => {
    expect(checkNewPassword(RUT, password)).toMatch(/al menos 8 caracteres/);
  });

  it("rechaza una clave más larga que el máximo", () => {
    expect(
      checkNewPassword(RUT, "a".repeat(PASSWORD_POLICY.maxLength + 1))
    ).toMatch(/como máximo/);
  });

  it.each([
    ["la clave inicial con relleno", "5678abcd"],
    ["el cuerpo del RUT", "12345678"],
    ["el RUT con DV", "12345678-5"],
    ["el RUT con puntos", "12.345.678-5"],
    ["un tramo del medio", "Hola3456Mundo"],
    ["el inicio del cuerpo", "1234Soprole"],
  ])("rechaza %s", (_caso, password) => {
    expect(checkNewPassword(RUT, password)).toMatch(/RUT/);
  });

  it("detecta el tramo aunque venga separado por puntos o guiones", () => {
    expect(checkNewPassword(RUT, "clave-56.78-x")).toMatch(/RUT/);
  });

  it("acepta dígitos que no forman un tramo de 4 del RUT", () => {
    expect(checkNewPassword(RUT, "Clave 1243 9999")).toBeNull();
  });
});
