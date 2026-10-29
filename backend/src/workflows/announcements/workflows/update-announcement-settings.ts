import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import {
  updateAnnouncementSettingsStep,
  UpdateAnnouncementSettingsInput,
} from "../steps/update-announcement-settings";

export const updateAnnouncementSettingsWorkflow = createWorkflow(
  "update-announcement-settings",
  function (input: UpdateAnnouncementSettingsInput) {
    return new WorkflowResponse(updateAnnouncementSettingsStep(input));
  }
);
