import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { deleteAnnouncementsStep } from "../steps/delete-announcements";

export const deleteAnnouncementsWorkflow = createWorkflow(
  "delete-announcements",
  function (input: { id: string }) {
    return new WorkflowResponse(deleteAnnouncementsStep([input.id]));
  }
);
