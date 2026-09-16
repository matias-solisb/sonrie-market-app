import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { createBannersStep, CreateBannerInput } from "../steps/create-banners";

export const createBannersWorkflow = createWorkflow(
  "create-banners",
  function (input: CreateBannerInput[]) {
    return new WorkflowResponse(createBannersStep(input));
  }
);
