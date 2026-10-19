import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { authenticate } from "@medusajs/medusa";
import { deny } from "../../middlewares/deny";
import { ensureRole } from "../../middlewares/ensure-role";
import {
  storeCompanyQueryConfig,
  storeEmployeeQueryConfig,
} from "./query-config";
import {
  StoreCreateCompany,
  StoreCreateEmployee,
  StoreGetCompanyParams,
  StoreGetEmployeeParams,
  StoreUpdateApprovalSettings,
  StoreUpdateEmployee,
} from "./validators";

export const storeCompaniesMiddlewares: MiddlewareRoute[] = [
  /* Company middlewares */
  {
    method: "ALL",
    matcher: "/store/companies*",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/companies",
    middlewares: [
      validateAndTransformQuery(
        StoreGetCompanyParams,
        storeCompanyQueryConfig.list
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/store/companies",
    middlewares: [
      // Sonríe Market tiene una sola company (src/utils/sonrie-company.ts);
      // nadie la crea desde la tienda.
      deny("No se pueden crear empresas."),
      validateAndTransformBody(StoreCreateCompany),
      validateAndTransformQuery(
        StoreGetCompanyParams,
        storeCompanyQueryConfig.retrieve
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/store/companies/:id",
    middlewares: [
      validateAndTransformQuery(
        StoreGetCompanyParams,
        storeCompanyQueryConfig.retrieve
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/store/companies/:id",
    middlewares: [
      // El starter no lo protegía: cualquier customer logueado podía editar
      // la company. Igual que employees y approval-settings: solo company_admin.
      ensureRole("company_admin"),
      validateAndTransformQuery(
        StoreGetCompanyParams,
        storeCompanyQueryConfig.retrieve
      ),
    ],
  },

  {
    // El starter tampoco lo protegía: cualquier customer podía borrar la company.
    method: ["DELETE"],
    matcher: "/store/companies/:id",
    middlewares: [deny("No se pueden eliminar empresas.")],
  },
  /* Employee middlewares */
  {
    method: ["GET"],
    matcher: "/store/companies/:id/employees",
    middlewares: [
      validateAndTransformQuery(
        StoreGetEmployeeParams,
        storeEmployeeQueryConfig.list
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/store/companies/:id/employees",
    middlewares: [
      ensureRole("company_admin"),
      validateAndTransformBody(StoreCreateEmployee),
      validateAndTransformQuery(
        StoreGetEmployeeParams,
        storeEmployeeQueryConfig.list
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/store/companies/:id/employees/:employee_id",
    middlewares: [
      validateAndTransformQuery(
        StoreGetEmployeeParams,
        storeEmployeeQueryConfig.retrieve
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/store/companies/:id/employees/:employee_id",
    middlewares: [
      ensureRole("company_admin"),
      validateAndTransformBody(StoreUpdateEmployee),
      validateAndTransformQuery(
        StoreGetEmployeeParams,
        storeEmployeeQueryConfig.retrieve
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/store/companies/:id/approval-settings",
    middlewares: [
      ensureRole("company_admin"),
      validateAndTransformBody(StoreUpdateApprovalSettings),
    ],
  },
];
