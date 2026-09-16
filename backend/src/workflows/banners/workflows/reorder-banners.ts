import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { reorderBannersStep, ReorderBannersInput } from "../steps/reorder-banners";

export const reorderBannersWorkflow = createWorkflow(
  "reorder-banners",
  function (input: ReorderBannersInput) {
    return new WorkflowResponse(reorderBannersStep(input));
  }
);
