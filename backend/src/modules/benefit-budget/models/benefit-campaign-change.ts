import { model } from "@medusajs/framework/utils";
import { BenefitCampaign } from "./benefit-campaign";

/*

Auditoría de cambios a una campaña de beneficio (spec técnica §5:
"cambios administrativos" con trazabilidad). Una fila por edición desde el
Admin que cambie algo de verdad.

- `actor_id`: id del usuario del Admin que hizo el cambio (user_...). Null
  si el cambio no vino de una sesión de Admin (script, job).
- `cambios`: solo los campos que cambiaron, con su valor anterior y nuevo:
    { "tope_por_colaborador": { "anterior": 50000, "nuevo": 60000 } }
- `rige_desde`: periodo "YYYY-MM" desde el que rige un cambio de tope (el
  mes siguiente al del cambio: los saldos ya abiertos conservan su tope).
  Null si no cambió el tope.

Además de esta tabla, cada cambio se escribe en el log (Log Analytics).

*/
export const BenefitCampaignChange = model.define("benefit_campaign_change", {
  id: model.id({ prefix: "bcchg" }).primaryKey(),
  actor_id: model.text().nullable(),
  cambios: model.json(),
  rige_desde: model.text().nullable(),
  campaign: model.belongsTo(() => BenefitCampaign, {
    mappedBy: "cambios",
  }),
});
