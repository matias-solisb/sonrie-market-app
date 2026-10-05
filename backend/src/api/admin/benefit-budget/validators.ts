import { z } from "zod";

const Periodo = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato de periodo: YYYY-MM");

export type AdminGetBenefitBudgetParamsType = z.infer<
  typeof AdminGetBenefitBudgetParams
>;
export const AdminGetBenefitBudgetParams = z.object({
  periodo: Periodo.optional(),
});

export type AdminSetTopeOverrideType = z.infer<typeof AdminSetTopeOverride>;
export const AdminSetTopeOverride = z
  .object({
    periodo: Periodo.optional(),
    tope_override: z.number().int().min(0).nullable(),
  })
  .strict();

export type AdminUpdateBenefitCampaignType = z.infer<
  typeof AdminUpdateBenefitCampaign
>;
export const AdminUpdateBenefitCampaign = z
  .object({
    nombre: z.string().min(1).optional(),
    descripcion: z.string().nullable().optional(),
    tope_por_colaborador: z.number().int().min(0).optional(),
    estado: z.enum(["activa", "inactiva"]).optional(),
  })
  .strict();
