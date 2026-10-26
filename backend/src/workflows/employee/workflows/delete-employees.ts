import { removeRemoteLinkStep } from "@medusajs/medusa/core-flows";
import {
  createWorkflow,
  transform,
  WorkflowData,
  WorkflowResponse,
} from "@medusajs/workflows-sdk";
import { COMPANY_MODULE } from "../../../modules/company";
import { DeleteEmployeesInput, deleteEmployeesStep } from "../steps";

/*

Borra employees y su link con el customer (links/employee-customer.ts).

Sin quitar el link, el customer quedaba "vinculado" a un employee borrado y
no se le podía volver a crear uno ("Cannot create multiple links between
'company' and 'customer'"): el colaborador no podía volver a darse de alta.
Ahora, tras borrar el employee, el alta (Admin o script) lo vincula de nuevo
("vinculado"). La cuenta (customer + identidad rut) no se toca.

Si un paso falla, se restauran el employee y el link.

*/
export const deleteEmployeesWorkflow = createWorkflow(
  "delete-employees",
  (input: WorkflowData<DeleteEmployeesInput>): WorkflowResponse<string> => {
    const ids = deleteEmployeesStep(input);

    const links = transform({ ids }, ({ ids }) =>
      ids.length ? [{ [COMPANY_MODULE]: { employee_id: ids } }] : []
    );

    removeRemoteLinkStep(links);

    return new WorkflowResponse("Company customers deleted");
  }
);
