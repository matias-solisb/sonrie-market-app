import { MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { isValidEmail, normalizeEmail } from "../../../utils/email";
import { normalizeRut } from "../../../utils/rut";

/*

Valida y normaliza los datos del alta antes de crear nada.

- RUT: obligatorio y con DV correcto. Se normaliza ("12.345.678-5" →
  "12345678-5"), así cualquier forma de escribirlo es el mismo colaborador.
  Es el identificador de login (provider `rut`).
- Correo: obligatorio; se recorta y se pasa a minúsculas. Es el correo del
  customer y el destino de la recuperación de clave.
- Nombre y apellido: obligatorios.

No hay clave: la clave inicial la genera el provider `rut` a partir del RUT
(nunca la escribe una persona ni viaja en archivos).

Junta todos los errores en un solo mensaje, para corregirlos de una vez.

*/

export type ColaboradorInputRaw = {
  rut: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
};

export const validateColaboradorInputStep = createStep(
  "validate-colaborador-input",
  async (input: ColaboradorInputRaw) => {
    const rut = normalizeRut(input.rut);
    const email = normalizeEmail(input.email);
    const first_name = (input.first_name ?? "").trim();
    const last_name = (input.last_name ?? "").trim();

    const errors: string[] = [];

    if (!rut) {
      errors.push(`RUT inválido ("${input.rut ?? ""}")`);
    }
    if (!isValidEmail(email)) {
      errors.push(`correo inválido ("${input.email ?? ""}")`);
    }
    if (!first_name) {
      errors.push("falta el nombre");
    }
    if (!last_name) {
      errors.push("falta el apellido");
    }

    if (errors.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Datos del colaborador inválidos: ${errors.join("; ")}.`
      );
    }

    return new StepResponse({
      rut: rut as string,
      email,
      first_name,
      last_name,
      phone: input.phone?.trim() || null,
    });
  }
);
