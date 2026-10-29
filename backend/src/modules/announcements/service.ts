import { MedusaService } from "@medusajs/framework/utils";
import {
  ANNOUNCEMENT_SETTING_KEY,
  DEFAULT_COLOR_FONDO,
  DEFAULT_COLOR_TEXTO,
  DEFAULT_INTERVALO_SEGUNDOS,
  DEFAULT_LUGARES,
  AnnouncementPlace,
} from "./constants";
import { Announcement, AnnouncementSetting } from "./models";

export type AnnouncementSettings = {
  id: string;
  intervalo_segundos: number;
  lugares: AnnouncementPlace[];
  color_fondo: string;
  color_texto: string;
  color_borde: string | null;
};

class AnnouncementsModuleService extends MedusaService({
  Announcement,
  AnnouncementSetting,
}) {
  /**
   * Configuración general. La primera vez la crea con los valores por
   * defecto. Si dos requests llegan a la vez, el índice único sobre
   * `clave` hace fallar la segunda inserción y se relee la fila que
   * ganó.
   */
  async getSettings(): Promise<AnnouncementSettings> {
    const [found] = await this.listAnnouncementSettings(
      { clave: ANNOUNCEMENT_SETTING_KEY },
      { take: 1 }
    );

    if (found) {
      return this.toSettings_(found);
    }

    try {
      const created = await this.createAnnouncementSettings({
        clave: ANNOUNCEMENT_SETTING_KEY,
        intervalo_segundos: DEFAULT_INTERVALO_SEGUNDOS,
        lugares: DEFAULT_LUGARES as unknown as Record<string, unknown>,
        color_fondo: DEFAULT_COLOR_FONDO,
        color_texto: DEFAULT_COLOR_TEXTO,
        color_borde: null,
      });
      return this.toSettings_(created);
    } catch (error) {
      const [setting] = await this.listAnnouncementSettings(
        { clave: ANNOUNCEMENT_SETTING_KEY },
        { take: 1 }
      );
      if (!setting) {
        throw error;
      }
      return this.toSettings_(setting);
    }
  }

  private toSettings_(setting: any): AnnouncementSettings {
    return {
      id: setting.id,
      intervalo_segundos:
        setting.intervalo_segundos ?? DEFAULT_INTERVALO_SEGUNDOS,
      lugares: (Array.isArray(setting.lugares)
        ? setting.lugares
        : DEFAULT_LUGARES) as AnnouncementPlace[],
      color_fondo: setting.color_fondo ?? DEFAULT_COLOR_FONDO,
      color_texto: setting.color_texto ?? DEFAULT_COLOR_TEXTO,
      color_borde: setting.color_borde ?? null,
    };
  }
}

export default AnnouncementsModuleService;
