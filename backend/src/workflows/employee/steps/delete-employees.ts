import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { COMPANY_MODULE } from "../../../modules/company";
import { ICompanyModuleService } from "../../../types";

/*

Borra (soft delete) employees y devuelve sus ids, para que el workflow quite
también el link employee ↔ customer.

Acepta lo que mandan las rutas: un id, una lista de ids, o
`{ id, company_id }` (Admin → Companies → Employees → borrar), que además
exige que el employee sea de esa company. Ids que no existen se ignoran.

*/
export type DeleteEmployeesInput =
  | string
  | string[]
  | { id: string; company_id?: string };

export const deleteEmployeesStep = createStep(
  "delete-employees",
  async (
    input: DeleteEmployeesInput,
    { container }
  ): Promise<StepResponse<string[], string[]>> => {
    const companyModuleService =
      container.resolve<ICompanyModuleService>(COMPANY_MODULE);

    const filters =
      typeof input === "string" || Array.isArray(input)
        ? { id: Array.isArray(input) ? input : [input] }
        : {
            id: [input.id],
            ...(input.company_id ? { company_id: input.company_id } : {}),
          };

    const employees = await companyModuleService.listEmployees(filters as any, {
      select: ["id"],
    });
    const ids = employees.map((e) => e.id);

    if (ids.length) {
      await companyModuleService.softDeleteEmployees(ids);
    }

    return new StepResponse(ids, ids);
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return;
    }
    const companyModuleService =
      container.resolve<ICompanyModuleService>(COMPANY_MODULE);
    await companyModuleService.restoreEmployees(ids);
  }
);
