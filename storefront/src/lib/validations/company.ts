import { z } from "zod"

import { ModuleCompanySpendingLimitResetFrequency } from "@/types"
import {
  optionalString,
  requiredEmail,
  requiredString,
  requiredStringF,
} from "@/lib/validations/common"

// Datos editables de la empresa (/account/company → CompanyCard).
export const companySchema = z.object({
  name: requiredString("Nombre"),
  email: requiredEmail(),
  phone: optionalString(),
  address: requiredStringF("Dirección"),
  city: requiredStringF("Ciudad"),
  state: optionalString(),
  zip: requiredString("Código postal"),
  country: requiredString("País"),
  currency_code: requiredStringF("Moneda"),
  spending_limit_reset_frequency: z.nativeEnum(
    ModuleCompanySpendingLimitResetFrequency,
    { errorMap: () => ({ message: "Selecciona una frecuencia" }) }
  ),
})

export type CompanyFormValues = z.infer<typeof companySchema>

// Edición de un employee (EmployeesCard). El límite llega como string del
// input y se convierte a número al validar; vacío = 0 (sin límite).
export const employeeSchema = z.object({
  spending_limit: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+([.,]\d+)?$/.test(v), "Debe ser un número")
    .transform((v) => (v === "" ? 0 : Number(v.replace(",", ".")))),
  is_admin: z.enum(["true", "false"]),
})

export type EmployeeFormInput = z.input<typeof employeeSchema>
export type EmployeeFormValues = z.output<typeof employeeSchema>
