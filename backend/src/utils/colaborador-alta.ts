import { IAuthModuleService, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { RUT_AUTH_PROVIDER_ID } from "../modules/rut-auth/config";
import {
  ColaboradorOrigen,
  createColaboradorWorkflow,
} from "../workflows/colaborador/workflows";
import { createEmployeesWorkflow } from "../workflows/employee/workflows";
import { isValidEmail, normalizeEmail } from "./email";
import { normalizeRut } from "./rut";
import { ensureSonrieCompany } from "./sonrie-company";

/*

Alta idempotente de un colaborador: la usan el script
(src/scripts/alta-colaborador.ts) y el Admin (POST /admin/colaboradores), y
la reusarán bulk-import / employee-sync.

El workflow `create-colaborador` crea; esto decide si hay que crear. Por RUT:

  sin identidad                 → crea (workflow)              "creado"
  identidad + customer sin emp. → solo agrega el employee      "vinculado"
  identidad + customer + emp.   → nada                         "ya_existe"
  identidad sin customer        → nada, revisar a mano         "revisar"
  datos inválidos               → nada                         "invalido"
  el workflow falla (p. ej.
  correo ya usado)              → nada (el workflow revierte)  "error"

Nunca lanza por datos del colaborador: quien llama traduce el resultado a
log (script) o a status HTTP (Admin). Los mensajes no llevan el RUT en claro.

*/

export type AltaColaboradorInput = {
  rut: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  origen: ColaboradorOrigen;
};

export type AltaColaboradorResult =
  | { status: "creado"; customer_id: string; employee_id: string }
  | { status: "vinculado"; customer_id: string; employee_id: string }
  | { status: "ya_existe"; customer_id: string }
  | { status: "revisar"; message: string }
  | { status: "invalido"; message: string }
  | { status: "error"; message: string };

/** Customer (con su employee) vinculado a la identidad `rut` de ese RUT. */
export const findColaboradorByRut = async (
  container: MedusaContainer,
  rut: string
): Promise<null | { customer: { id: string; email: string; employee?: { id: string } | null } | null }> => {
  const authModule = container.resolve<IAuthModuleService>(Modules.AUTH);
  const [providerIdentity] = await authModule.listProviderIdentities({
    provider: RUT_AUTH_PROVIDER_ID,
    entity_id: rut,
  });

  if (!providerIdentity) {
    return null;
  }

  const authIdentity = await authModule.retrieveAuthIdentity(
    providerIdentity.auth_identity_id!
  );
  const customerId = authIdentity.app_metadata?.customer_id as string | undefined;

  if (!customerId) {
    return { customer: null };
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "employee.id"],
    filters: { id: customerId },
  });
  return { customer: (data[0] as any) ?? null };
};

/** Crea el employee (no admin, sin spending limit) del customer en la company. */
export const linkEmployee = async (
  container: MedusaContainer,
  customerId: string,
  companyId: string
) => {
  const { result } = await createEmployeesWorkflow(container).run({
    input: {
      customerId,
      employeeData: {
        customer_id: customerId,
        company_id: companyId,
        spending_limit: 0,
        is_admin: false,
      },
    },
  });
  return result as { id: string };
};

const invalidos = (input: AltaColaboradorInput): string[] => {
  const errors: string[] = [];
  if (!normalizeRut(input.rut)) {
    errors.push("RUT inválido (formato o dígito verificador)");
  }
  if (!isValidEmail(normalizeEmail(input.email))) {
    errors.push("correo inválido");
  }
  if (!input.first_name?.trim()) {
    errors.push("falta el nombre");
  }
  if (!input.last_name?.trim()) {
    errors.push("falta el apellido");
  }
  return errors;
};

export const altaColaborador = async (
  container: MedusaContainer,
  input: AltaColaboradorInput
): Promise<AltaColaboradorResult> => {
  const errors = invalidos(input);

  if (errors.length) {
    return { status: "invalido", message: `Datos inválidos: ${errors.join("; ")}.` };
  }

  const rut = normalizeRut(input.rut) as string;
  const { company } = await ensureSonrieCompany(container);
  const existing = await findColaboradorByRut(container, rut);

  if (existing?.customer?.employee?.id) {
    return { status: "ya_existe", customer_id: existing.customer.id };
  }

  if (existing?.customer) {
    const employee = await linkEmployee(container, existing.customer.id, company.id);
    return {
      status: "vinculado",
      customer_id: existing.customer.id,
      employee_id: employee.id,
    };
  }

  if (existing) {
    return {
      status: "revisar",
      message: "El RUT tiene identidad pero ningún cliente vinculado. Hay que revisarlo a mano.",
    };
  }

  try {
    const { result } = await createColaboradorWorkflow(container).run({
      input: {
        company_id: company.id,
        rut,
        email: input.email,
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone ?? null,
        origen: input.origen,
      },
    });

    return {
      status: "creado",
      customer_id: result.customer.id,
      employee_id: result.employee.id,
    };
  } catch (e: any) {
    // El workflow ya revirtió lo creado: no quedan cuentas a medias.
    return { status: "error", message: e?.message ?? String(e) };
  }
};
