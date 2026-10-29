import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import {
  updateAnnouncementsStep,
  UpdateAnnouncementInput,
} from "../steps/update-announcements";

export const updateAnnouncementsWorkflow = createWorkflow(
  "update-announcements",
  function (input: UpdateAnnouncementInput) {
    return new WorkflowResponse(updateAnnouncementsStep(input));
  }
);
