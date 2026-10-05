import { model } from "@medusajs/framework/utils";
import { BenefitCampaign } from "./benefit-campaign";
import { BenefitMovement } from "./benefit-movement";

/*

Saldo de un colaborador en una campaña y un periodo (spec técnica §4.2,
entidad `EmployeeBudget`).

- `periodo`: "YYYY-MM" en hora de Santiago (ver utils/period.ts).
- `tope`: copia del tope de la campaña al crear la fila. Si después se
  cambia el tope de la campaña, el mes en curso no se altera.
- `tope_override`: excepción para este colaborador en este periodo (la spec
  dice "tope con override opcional para excepciones"). El tope efectivo es
  `COALESCE(tope_override, tope)`.
- `consumido`: suma de los movimientos vigentes. Solo lo modifica el
  service con UPDATE atómico; nunca escribirlo a mano.
- `disponible` NO se guarda: se calcula (tope efectivo - consumido).

`customer_id` es un campo plano (no relación) y se expone a `query.graph`
con un link de solo lectura (src/links/employee-budget-customer.ts).

Una fila por (customer_id, campaign, periodo). La fila de un periodo se crea
la primera vez que se necesita, así que el "reinicio mensual" no requiere
borrar ni poner en cero nada: el mes nuevo simplemente es otra fila.

*/
export const EmployeeBudget = model
  .define("employee_budget", {
    id: model.id({ prefix: "ebud" }).primaryKey(),
    customer_id: model.text(),
    periodo: model.text(),
    tope: model.number(),
    tope_override: model.number().nullable(),
    consumido: model.number().default(0),
    campaign: model.belongsTo(() => BenefitCampaign, {
      mappedBy: "presupuestos",
    }),
    movimientos: model.hasMany(() => BenefitMovement, {
      mappedBy: "presupuesto",
    }),
  })
  .indexes([
    {
      on: ["customer_id", "campaign_id", "periodo"],
      unique: true,
    },
    {
      on: ["customer_id"],
    },
  ]);
