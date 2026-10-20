import { ExecArgs, IAuthModuleService, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { RUT_AUTH_PROVIDER_ID } from "../modules/rut-auth/config";
import { isValidEmail, normalizeEmail } from "../utils/email";
import { maskRut, normalizeRut } from "../utils/rut";
import { ensureSonrieCompany } from "../utils/sonrie-company";
import { createColaboradorWorkflow } from "../workflows/colaborador/workflows";
import { createEmployeesWorkflow } from "../workflows/employee/workflows";

/*

Alta manual de colaboradores, mientras no exista bulk-import.
Reemplaza los `curl` de "dev-crear-usuario-prueba-storefront". Idempotente
por RUT.

  # crea la company única (si falta) y un colaborador
  npx medusa exec ./src/scripts/alta-colaborador.ts 12.345.678-5 juana.perez@sonriemarket.cl Juana "Pérez Soto"

  # vincula a la company los customers con cuenta que no tienen employee
  # (p. ej. los usuarios de prueba creados antes con curl)
  npx medusa exec ./src/scripts/alta-colaborador.ts vincular-existentes

Si el RUT ya tiene identidad, no crea nada: solo le agrega el employee al
customer si le falta.

No se pide ni se escribe ninguna clave: la clave inicial la genera la
plataforma (últimos 4 dígitos del RUT antes del DV) y el colaborador debe
cambiarla en su primer ingreso. En el log el RUT aparece enmascarado.
Manual de uso: docs/manual-usuarios.md.

*/

type Logger = { info: (m: string) => void; warn: (m: string) => void };

/** Customer (con su employee) vinculado a la identidad `rut` de ese RUT. */
const findByRut = async (container: MedusaContainer, rut: string) => {
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
  return { customer: data[0] ?? null };
};

const linkEmployee = (container: MedusaContainer, customerId: string, companyId: string) =>
  createEmployeesWorkflow(container).run({
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

const vincularExistentes = async (
  container: MedusaContainer,
  companyId: string,
  logger: Logger
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "employee.id"],
    filters: { has_account: true },
  });

  const sinEmployee = customers.filter((c: any) => !c.employee?.id);

  for (const customer of sinEmployee) {
    await linkEmployee(container, customer.id, companyId);
    logger.info(`✔ ${customer.email}: vinculado a la company.`);
  }

  logger.info(
    `${sinEmployee.length} vinculados; ${customers.length - sinEmployee.length} ya tenían employee.`
  );
};

export default async function altaColaborador({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const { company, created } = await ensureSonrieCompany(container);
  logger.info(
    created
      ? `✔ Company "${company.name}" creada (${company.id}).`
      : `Company "${company.name}" (${company.id}).`
  );

  if (args?.[0] === "vincular-existentes") {
    await vincularExistentes(container, company.id, logger);
    return;
  }

  const [rutArg, email, first_name, last_name, ...extra] = args ?? [];

  if (extra.length) {
    logger.warn(
      "Sobran argumentos. Si el nombre o el apellido tienen espacios, escríbelos entre comillas: \"Pérez Soto\". " +
        "La clave no va en el comando: la genera la plataforma."
    );
    return;
  }

  if (!rutArg || !email || !first_name || !last_name) {
    logger.warn(
      'Uso: npx medusa exec ./src/scripts/alta-colaborador.ts <rut> <correo> <nombre> "<apellido>"'
    );
    return;
  }

  const rut = normalizeRut(rutArg);

  if (!rut) {
    logger.warn(`✘ RUT inválido (formato o dígito verificador). No se creó nada.`);
    return;
  }

  if (!isValidEmail(normalizeEmail(email))) {
    logger.warn(`✘ Correo inválido: "${email}". No se creó nada.`);
    return;
  }

  const existing = await findByRut(container, rut);

  if (existing?.customer?.employee?.id) {
    logger.info(`RUT ${maskRut(rut)} ya existe y tiene employee; no se hace nada.`);
    return;
  }

  if (existing?.customer) {
    await linkEmployee(container, existing.customer.id, company.id);
    logger.info(`✔ RUT ${maskRut(rut)} ya existía sin employee: vinculado a la company.`);
    return;
  }

  if (existing) {
    logger.warn(
      `✘ RUT ${maskRut(rut)} tiene identidad pero ningún customer vinculado. Revisar a mano; no se creó nada.`
    );
    return;
  }

  try {
    const { result } = await createColaboradorWorkflow(container).run({
      input: { company_id: company.id, rut, email, first_name, last_name },
    });

    logger.info(
      `✔ Colaborador RUT ${maskRut(rut)} creado (customer ${result.customer.id}, employee ${result.employee.id}). ` +
        "Clave inicial: últimos 4 dígitos del RUT; se le pedirá cambiarla al primer ingreso."
    );
  } catch (e: any) {
    // El workflow ya revirtió lo creado: no quedan cuentas a medias.
    logger.warn(`✘ No se creó el colaborador: ${e?.message ?? e}`);
  }
}
