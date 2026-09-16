import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { deleteBannersStep } from "../steps/delete-banners";

export const deleteBannersWorkflow = createWorkflow(
  "delete-banners",
  function (input: { id: string }) {
    return new WorkflowResponse(deleteBannersStep([input.id]));
  }
);
