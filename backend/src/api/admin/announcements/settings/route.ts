import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ANNOUNCEMENTS_MODULE } from "../../../../modules/announcements";
import AnnouncementsModuleService from "../../../../modules/announcements/service";
import { updateAnnouncementSettingsWorkflow } from "../../../../workflows/announcements/workflows/update-announcement-settings";
import { AdminUpdateAnnouncementSettingsType } from "../validators";

// Configuración general de la barra (botón engranaje del Admin).
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service =
    req.scope.resolve<AnnouncementsModuleService>(ANNOUNCEMENTS_MODULE);

  res.json({ settings: await service.getSettings() });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateAnnouncementSettingsType>,
  res: MedusaResponse
) => {
  const { result: settings } = await updateAnnouncementSettingsWorkflow.run({
    input: req.validatedBody,
    container: req.scope,
  });

  res.json({ settings });
};
