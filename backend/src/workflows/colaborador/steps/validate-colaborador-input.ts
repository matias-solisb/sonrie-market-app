import { MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { isValidEmail, normalizeEmail } from "../../../utils/email";

/*

Valida y normaliza los datos del alta antes de crear nada.

- Correo: se recorta y se pasa a minúsculas. Así "Juana.Perez@…" y
  " juana.perez@… " son el mismo colaborador (emailpass compara el correo
  tal cual y, sin esto, permitía dos cuentas para la misma persona).
- Clave: mínimo 8 caracteres. Provisorio, mientras el login sea emailpass;
  la política definitiva se define con rut-auth.
- Nombre y apellido: obligatorios.

Junta todos los errores en un solo mensaje, para corregirlos de una vez.

*/

export type ColaboradorInputRaw = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
};

export const PASSWORD_MIN_LENGTH = 8;

export const validateColaboradorInputStep = createStep(
  "validate-colaborador-input",
  async (input: ColaboradorInputRaw) => {
    const email = normalizeEmail(input.email);
    const first_name = (input.first_name ?? "").trim();
    const last_name = (input.last_name ?? "").trim();
    const password = input.password ?? "";

    const errors: string[] = [];

    if (!isValidEmail(email)) {
      errors.push(`correo inválido ("${input.email ?? ""}")`);
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      errors.push(`la clave debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
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
      email,
      password,
      first_name,
      last_name,
      phone: input.phone?.trim() || null,
    });
  }
);
