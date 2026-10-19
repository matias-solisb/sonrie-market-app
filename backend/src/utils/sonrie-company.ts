import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import {
  ModuleCompanySpendingLimitResetFrequency,
  ModuleCreateCompany,
} from "../types";
import { createCompaniesWorkflow } from "../workflows/company/workflows";

/*

La company única de la tienda.

Sonríe Market es una tienda interna: todos los colaboradores compran como
employees de UNA sola company (Soprole). El modelo company/employee del
B2B Starter se conserva porque el módulo de aprobaciones depende de él
(spec §9: "Excepciones/autorizaciones → módulo de aprobaciones del B2B
Starter"), pero nunca se crean más companies.

- `spending_limit_reset_frequency` y `employee.spending_limit` no se usan:
  el tope lo controla benefit-budget (ver workflows/hooks/validate-cart-completion.ts).
- `createCompaniesWorkflow` crea también sus approval settings (ambas
  aprobaciones en false), así que el checkout no pide aprobación.
- No se le asigna customer group: hoy nada lo usa (precios por grupo).
  Si se necesita, `addCompanyToCustomerGroupWorkflow` lo agrega después y
  suma a los employees existentes.

*/

export const SONRIE_COMPANY: ModuleCreateCompany = {
  name: "Soprole",
  email: "no-reply@notificaciones.sonriemarket.cl",
  phone: "",
  address: null,
  city: null,
  state: null,
  zip: null,
  country: "cl",
  logo_url: null,
  currency_code: "clp",
  spending_limit_reset_frequency: ModuleCompanySpendingLimitResetFrequency.NEVER,
};

/** La company única, o null si todavía no existe. Error si hay más de una. */
export const findSonrieCompany = async (
  container: MedusaContainer
): Promise<{ id: string; name: string } | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: companies } = await query.graph({
    entity: "company",
    fields: ["id", "name"],
    pagination: { take: 2 },
  });

  if (companies.length > 1) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Hay más de una company; Sonríe Market debe tener solo una."
    );
  }

  return companies[0] ?? null;
};

/** Devuelve la company única y la crea si no existe. Idempotente. */
export const ensureSonrieCompany = async (container: MedusaContainer) => {
  const existing = await findSonrieCompany(container);

  if (existing) {
    return { company: existing, created: false };
  }

  const { result } = await createCompaniesWorkflow(container).run({
    input: [SONRIE_COMPANY],
  });

  return { company: { id: result[0].id, name: result[0].name }, created: true };
};
