import { defineLink } from "@medusajs/framework/utils";
import CustomerModule from "@medusajs/medusa/customer";
import BenefitBudgetModule from "../modules/benefit-budget";

/*

Link de solo lectura: EmployeeBudget.customer_id -> Customer.

No crea tabla pivote (el id ya vive en employee_budget.customer_id); solo
le enseña a `query.graph` a resolver `employee_budget.customer`. Ejemplo:

  query.graph({
    entity: "employee_budget",
    fields: ["periodo", "consumido", "customer.email"],
  })

*/
export default defineLink(
  {
    linkable: BenefitBudgetModule.linkable.employeeBudget,
    field: "customer_id",
  },
  CustomerModule.linkable.customer,
  { readOnly: true }
);
