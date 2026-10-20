import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { createEmployeesWorkflow } from "../../employee/workflows";
import {
  registerRutIdentityStep,
  validateColaboradorInputStep,
} from "../steps";

/*

Alta de un colaborador (tarea B.1, parte "alta").

Deja al colaborador listo para comprar, en una sola operación:

  auth identity (rut) ─► customer (has_account) ─► employee de la company única

0. Valida y normaliza los datos (RUT con DV correcto, correo en minúsculas,
   nombre y apellido): si algo falla, no se crea nada.
1. Identidad de auth con el provider `rut`: entity_id = RUT normalizado,
   clave inicial generada por la plataforma (últimos 4 dígitos del RUT) y
   must_change_password = true. Falla si el RUT ya tiene identidad.
2. Customer vinculado a esa identidad (`createCustomerAccountWorkflow` del
   core: deja `app_metadata.customer_id` en la identidad).
3. Employee de la company con `is_admin: false` y `spending_limit: 0`
   (`createEmployeesWorkflow`: crea el employee y el link employee-customer).
   `is_admin` es el "administrador de la empresa" del B2B Starter (gestiona
   employees y aprueba carritos desde la tienda), no un usuario del Admin:
   ningún colaborador lo tiene.

Si un paso falla, se compensan los anteriores: no quedan identidades ni
customers huérfanos.

No crea la fila de benefit-budget: el checkout la crea si no existe y el
job diario `benefit-budget-period` abre el mes para todos.

La idempotencia (no duplicar si el colaborador ya existe) la resuelve quien
llama — ver src/scripts/alta-colaborador.ts —, porque este workflow es la
unidad que reusarán bulk-import y employee-sync.

*/

export type CreateColaboradorInput = {
  company_id: string;
  rut: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
};

export const createColaboradorWorkflow = createWorkflow(
  "create-colaborador",
  function (input: CreateColaboradorInput) {
    const data = validateColaboradorInputStep({
      rut: input.rut,
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone,
    });

    const authIdentityId = registerRutIdentityStep({ rut: data.rut });

    const customerData = transform({ data }, ({ data }) => ({
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
    }));

    const customer = createCustomerAccountWorkflow.runAsStep({
      input: { authIdentityId, customerData },
    });

    const employeeInput = transform(
      { customer, input },
      ({ customer, input }) => ({
        customerId: customer.id,
        employeeData: {
          customer_id: customer.id,
          company_id: input.company_id,
          spending_limit: 0,
          is_admin: false,
        },
      })
    );

    const employee = createEmployeesWorkflow.runAsStep({
      input: employeeInput,
    });

    return new WorkflowResponse({ customer, employee });
  }
);
