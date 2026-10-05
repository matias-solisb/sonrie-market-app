import { StoreBenefitBudget } from "./benefit-budget"
import { HttpTypes } from "@medusajs/types"
import { QueryCompany, QueryEmployee } from "@/types"
import { QueryApproval, QueryApprovalStatus } from "./approval/query"

export enum SpendingLimitResetFrequency {
  never = "never",
  daily = "daily",
  weekly = "weekly",
  monthly = "monthly",
  yearly = "yearly",
}

export interface B2BCart extends HttpTypes.StoreCart {
  completed_at?: string
  company: QueryCompany
  promotions?: HttpTypes.StorePromotion[]
  customer?: HttpTypes.StoreCustomer
  approvals?: QueryApproval[]
  approval_status?: QueryApprovalStatus
}

export interface B2BOrder extends HttpTypes.StoreOrder {
  company: QueryCompany
}

export interface B2BCustomer extends HttpTypes.StoreCustomer {
  employee: QueryEmployee | null
  // Saldo de beneficio del periodo vigente (GET /store/benefit-budget).
  // null si no hay campaña activa o no se pudo obtener.
  benefit_budget?: StoreBenefitBudget | null
  orders?: HttpTypes.StoreOrder[]
  cart?: B2BCart[]
}

export type FilterType = string | string[] | { [key: string]: any }
