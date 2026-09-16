import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { updateBannersStep, UpdateBannerInput } from "../steps/update-banners";

export const updateBannersWorkflow = createWorkflow(
  "update-banners",
  function (input: UpdateBannerInput) {
    return new WorkflowResponse(updateBannersStep(input));
  }
);
