import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { SetTopeOverrideInput } from "../../../modules/benefit-budget/types";
import { setBenefitTopeOverrideStep } from "../steps";

/*

Excepción de tope para un colaborador en un periodo (o quitarla con
`tope_override: null`). Lo usa POST /admin/benefit-budget/customers/:id/override.

*/
export const setBenefitTopeOverrideWorkflow = createWorkflow(
  "set-benefit-tope-override",
  function (input: SetTopeOverrideInput) {
    return new WorkflowResponse(setBenefitTopeOverrideStep(input));
  }
);
