import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ANNOUNCEMENTS_MODULE } from "../../../modules/announcements";
import AnnouncementsModuleService from "../../../modules/announcements/service";

export const deleteAnnouncementsStep = createStep(
  "delete-announcements",
  async (ids: string[], { container }) => {
    const service =
      container.resolve<AnnouncementsModuleService>(ANNOUNCEMENTS_MODULE);

    await service.softDeleteAnnouncements(ids);

    return new StepResponse(ids, ids);
  },
  async (ids: string[] | undefined, { container }) => {
    if (!ids?.length) {
      return;
    }

    const service =
      container.resolve<AnnouncementsModuleService>(ANNOUNCEMENTS_MODULE);

    await service.restoreAnnouncements(ids);
  }
);
