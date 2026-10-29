import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ANNOUNCEMENTS_MODULE } from "../../../modules/announcements";
import AnnouncementsModuleService from "../../../modules/announcements/service";
import { CreateAnnouncementInput } from "./create-announcements";

export type UpdateAnnouncementInput = Partial<CreateAnnouncementInput> & {
  id: string;
};

export const updateAnnouncementsStep = createStep(
  "update-announcements",
  async (input: UpdateAnnouncementInput, { container }) => {
    const service =
      container.resolve<AnnouncementsModuleService>(ANNOUNCEMENTS_MODULE);

    const previous = await service.retrieveAnnouncement(input.id);
    const updated = await service.updateAnnouncements(input);

    return new StepResponse(updated, previous);
  },
  async (previous: any, { container }) => {
    if (!previous) {
      return;
    }

    const service =
      container.resolve<AnnouncementsModuleService>(ANNOUNCEMENTS_MODULE);

    await service.updateAnnouncements({
      id: previous.id,
      nombre: previous.nombre,
      texto: previous.texto,
      link: previous.link,
      icono: previous.icono,
      posicion_icono: previous.posicion_icono,
      fecha_inicio: previous.fecha_inicio,
      fecha_fin: previous.fecha_fin,
      activo: previous.activo,
    });
  }
);
