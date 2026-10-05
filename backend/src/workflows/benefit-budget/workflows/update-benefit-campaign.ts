import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  UpdateBenefitCampaignInput,
  updateBenefitCampaignStep,
} from "../steps";

export const updateBenefitCampaignWorkflow = createWorkflow(
  "update-benefit-campaign",
  function (input: UpdateBenefitCampaignInput) {
    return new WorkflowResponse(updateBenefitCampaignStep(input));
  }
);
