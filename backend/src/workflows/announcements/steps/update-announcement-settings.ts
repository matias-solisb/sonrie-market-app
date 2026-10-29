import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ANNOUNCEMENTS_MODULE } from "../../../modules/announcements";
import AnnouncementsModuleService, {
  AnnouncementSettings,
} from "../../../modules/announcements/service";

export type UpdateAnnouncementSettingsInput = Partial<
  Omit<AnnouncementSettings, "id">
>;

// Edita la fila única de configuración (la crea si no existe vía
// getSettings). La compensación restaura los valores previos.
export const updateAnnouncementSettingsStep = createStep(
  "update-announcement-settings",
  async (input: UpdateAnnouncementSettingsInput, { container }) => {
    const service =
      container.resolve<AnnouncementsModuleService>(ANNOUNCEMENTS_MODULE);

    const previous = await service.getSettings();

    const { lugares, ...rest } = input;
    await service.updateAnnouncementSettings({
      id: previous.id,
      ...rest,
      ...(lugares
        ? { lugares: lugares as unknown as Record<string, unknown> }
        : {}),
    });

    return new StepResponse(await service.getSettings(), previous);
  },
  async (previous: AnnouncementSettings | undefined, { container }) => {
    if (!previous) {
      return;
    }

    const service =
      container.resolve<AnnouncementsModuleService>(ANNOUNCEMENTS_MODULE);

    await service.updateAnnouncementSettings({
      ...previous,
      lugares: previous.lugares as unknown as Record<string, unknown>,
    });
  }
);
