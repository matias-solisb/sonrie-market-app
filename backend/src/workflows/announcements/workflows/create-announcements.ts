import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import {
  createAnnouncementsStep,
  CreateAnnouncementInput,
} from "../steps/create-announcements";

export const createAnnouncementsWorkflow = createWorkflow(
  "create-announcements",
  function (input: CreateAnnouncementInput[]) {
    return new WorkflowResponse(createAnnouncementsStep(input));
  }
);
