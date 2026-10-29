import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ANNOUNCEMENTS_MODULE } from "../../../modules/announcements";
import AnnouncementsModuleService from "../../../modules/announcements/service";
import {
  AnnouncementIcon,
  AnnouncementIconPosition,
} from "../../../modules/announcements/constants";

export type CreateAnnouncementInput = {
  nombre: string;
  texto: string;
  link?: string | null;
  icono?: AnnouncementIcon | null;
  posicion_icono?: AnnouncementIconPosition;
  fecha_inicio?: Date | null;
  fecha_fin?: Date | null;
  activo?: boolean;
};

export const createAnnouncementsStep = createStep(
  "create-announcements",
  async (input: CreateAnnouncementInput[], { container }) => {
    const service =
      container.resolve<AnnouncementsModuleService>(ANNOUNCEMENTS_MODULE);

    const announcements = await service.createAnnouncements(input);

    return new StepResponse(
      announcements,
      announcements.map((announcement) => announcement.id)
    );
  },
  async (ids: string[] | undefined, { container }) => {
    if (!ids?.length) {
      return;
    }

    const service =
      container.resolve<AnnouncementsModuleService>(ANNOUNCEMENTS_MODULE);

    await service.deleteAnnouncements(ids);
  }
);
