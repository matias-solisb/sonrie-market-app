import readline from "node:readline";
import { ExecArgs, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { isValidEmail, normalizeEmail } from "../utils/email";
import { ensureSonrieCompany } from "../utils/sonrie-company";
import { createColaboradorWorkflow } from "../workflows/colaborador/workflows";
import { createEmployeesWorkflow } from "../workflows/employee/workflows";

/*

Alta manual de colaboradores, mientras no existan bulk-import ni rut-auth.
Reemplaza los `curl` de "dev-crear-usuario-prueba-storefront". Idempotente.

  # crea la company única (si falta) y un colaborador; pide la clave
  npx medusa exec ./src/scripts/alta-colaborador.ts juana.perez@sonriemarket.cl Juana "Pérez Soto"

  # vincula a la company los customers con cuenta que no tienen employee
  # (p. ej. los usuarios de prueba creados antes con curl)
  npx medusa exec ./src/scripts/alta-colaborador.ts vincular-existentes

Si el correo ya tiene un customer con cuenta, no crea otro: solo le agrega
el employee si le falta.

La clave NO va en el comando (quedaría en el historial de la consola): el
script la pide dos veces sin mostrarla. Nunca se escribe en el log.
Manual de uso: docs/manual-usuarios.md.

*/

type Logger = { info: (m: string) => void; warn: (m: string) => void };

/**
 * Pide uno o más textos por consola sin mostrarlos (solo se ven las
 * preguntas). Lee las líneas con un iterador, que no pierde las que llegan
 * antes de tiempo: funciona igual en una terminal interactiva que con la
 * entrada redirigida.
 */
const askHidden = async (questions: string[]) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  // No mostrar lo que se escribe (ni el eco de la terminal).
  (rl as any)._writeToOutput = () => {};

  const lines = rl[Symbol.asyncIterator]();
  const answers: string[] = [];

  for (const question of questions) {
    process.stdout.write(question);
    const { value } = await lines.next();
    process.stdout.write("\n");
    answers.push(value ?? "");
  }

  rl.close();
  return answers;
};

const findAccountCustomer = async (container: MedusaContainer, email: string) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "employee.id"],
    filters: { email, has_account: true },
  });
  return data[0] ?? null;
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

  const [email, first_name, last_name, ...extra] = args ?? [];

  if (extra.length) {
    logger.warn(
      "La clave no va en el comando (queda en el historial). Quítala: el script la pide. " +
        'Si el nombre o el apellido tienen espacios, escríbelos entre comillas: "Pérez Soto".'
    );
    return;
  }

  if (!email || !first_name || !last_name) {
    logger.warn(
      'Uso: npx medusa exec ./src/scripts/alta-colaborador.ts <correo> <nombre> "<apellido>"'
    );
    return;
  }

  // Antes de pedir la clave: no tiene sentido escribirla si el correo está mal.
  if (!isValidEmail(normalizeEmail(email))) {
    logger.warn(`✘ Correo inválido: "${email}". No se creó nada.`);
    return;
  }

  const existing = await findAccountCustomer(container, normalizeEmail(email));

  if (existing?.employee?.id) {
    logger.info(`${email} ya existe y tiene employee; no se hace nada.`);
    return;
  }

  if (existing) {
    await linkEmployee(container, existing.id, company.id);
    logger.info(`✔ ${email} ya existía sin employee: vinculado a la company.`);
    return;
  }

  const [password, confirmacion] = await askHidden([
    `Clave inicial para ${email}: `,
    "Repite la clave: ",
  ]);

  if (password !== confirmacion) {
    logger.warn("Las claves no coinciden. No se creó nada; vuelve a correr el comando.");
    return;
  }

  try {
    const { result } = await createColaboradorWorkflow(container).run({
      input: { company_id: company.id, email, password, first_name, last_name },
    });

    logger.info(
      `✔ Colaborador ${result.customer.email} creado (customer ${result.customer.id}, employee ${result.employee.id}).`
    );
  } catch (e: any) {
    // El workflow ya revirtió lo creado: no quedan cuentas a medias.
    logger.warn(`✘ No se creó el colaborador: ${e?.message ?? e}`);
  }
}
