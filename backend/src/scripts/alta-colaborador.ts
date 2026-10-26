import { ExecArgs, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { altaColaborador as alta, linkEmployee } from "../utils/colaborador-alta";
import { maskRut, normalizeRut } from "../utils/rut";
import { ensureSonrieCompany } from "../utils/sonrie-company";

/*

Alta manual de colaboradores desde la consola del backend. Lo mismo que
Admin → Clientes → "Alta de colaborador" (misma lógica:
src/utils/colaborador-alta.ts). Reemplaza los `curl` de
"dev-crear-usuario-prueba-storefront". Idempotente por RUT. Las cuentas
quedan con `metadata.origen = "manual"`.

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

  const masked = maskRut(normalizeRut(rutArg) ?? rutArg);
  const result = await alta(container, {
    rut: rutArg,
    email,
    first_name,
    last_name,
    origen: "manual",
  });

  switch (result.status) {
    case "creado":
      logger.info(
        `✔ Colaborador RUT ${masked} creado (customer ${result.customer_id}, employee ${result.employee_id}). ` +
          "Clave inicial: últimos 4 dígitos del RUT; se le pedirá cambiarla al primer ingreso."
      );
      return;
    case "vinculado":
      logger.info(`✔ RUT ${masked} ya existía sin employee: vinculado a la company.`);
      return;
    case "ya_existe":
      logger.info(`RUT ${masked} ya existe y tiene employee; no se hace nada.`);
      return;
    case "revisar":
      logger.warn(`✘ RUT ${masked}: ${result.message} No se creó nada.`);
      return;
    case "invalido":
      logger.warn(`✘ ${result.message} No se creó nada.`);
      return;
    case "error":
      logger.warn(`✘ No se creó el colaborador: ${result.message}`);
      return;
  }
}
