import { model } from "@medusajs/framework/utils";
import { EmployeeBudget } from "./employee-budget";

/*

Campaña de beneficio (spec técnica §4.2, entidad `Campaign`).

Se llama `benefit_campaign` y no `campaign` porque el módulo Promotion del
core ya tiene una entidad `campaign`: con el mismo nombre.

MVP: una sola campaña activa, mensual, de $50.000 ("Beneficio mensual").
`modo_exceso` ya existe para que F2 no requiera migración, pero en el MVP
solo se aplica `bloqueo_duro`. `fecha_inicio`/`fecha_fin` son para las
campañas por rango de fechas (F2). Las reglas por producto/categoría
(`reglas_producto`) llegan en F2 como entidad propia.
*/
export const BenefitCampaign = model.define("benefit_campaign", {
  id: model.id({ prefix: "bcamp" }).primaryKey(),
  nombre: model.text(),
  descripcion: model.text().nullable(),
  tope_por_colaborador: model.number(),
  periodo: model.enum(["mensual", "rango"]).default("mensual"),
  fecha_inicio: model.dateTime().nullable(),
  fecha_fin: model.dateTime().nullable(),
  modo_exceso: model
    .enum(["bloqueo_duro", "requiere_aprobacion"])
    .default("bloqueo_duro"),
  estado: model.enum(["activa", "inactiva"]).default("activa"),
  presupuestos: model.hasMany(() => EmployeeBudget, {
    mappedBy: "campaign",
  }),
});
