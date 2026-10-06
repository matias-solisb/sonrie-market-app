import { z } from "zod"

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
})

export type CompanyFormValues = z.infer<typeof companySchema>

// Edición de un employee (EmployeesCard). Solo los permisos: el límite de
// gasto del B2B Starter (`spending_limit`) ya no se usa; el tope de compra
// es el cupo mensual del módulo benefit-budget.
export const employeeSchema = z.object({
  is_admin: z.enum(["true", "false"]),
})

export type EmployeeFormInput = z.input<typeof employeeSchema>
export type EmployeeFormValues = z.output<typeof employeeSchema>
