import { createSelectParams } from "@medusajs/medusa/api/utils/validators";
import { z } from "zod";
import {
  ANNOUNCEMENT_ICON_POSITIONS,
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_PLACES,
  MAX_INTERVALO_SEGUNDOS,
  MAX_TEXTO_LENGTH,
  MIN_INTERVALO_SEGUNDOS,
} from "../../../modules/announcements/constants";

// Solo URLs absolutas http(s) o rutas internas "/..." (no "//host", que el
// navegador trata como URL externa). Bloquea javascript:, data:, etc.
const LINK_REGEX = /^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const link = z
  .union([z.string().trim(), z.null()])
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || LINK_REGEX.test(value), {
    message: "El link debe empezar con https:// o con / (ruta de la tienda)",
  });

// "" o null = sin límite. Acepta ISO 8601 (con zona) y lo deja como Date.
const fecha = z
  .union([z.literal(""), z.null(), z.coerce.date()])
  .transform((value) => (value instanceof Date ? value : null));

const icono = z.union([z.enum(ANNOUNCEMENT_ICONS), z.null()]);

export type AdminGetAnnouncementParamsType = z.infer<
  typeof AdminGetAnnouncementParams
>;
export const AdminGetAnnouncementParams = createSelectParams();

export type AdminListAnnouncementsParamsType = z.infer<
  typeof AdminListAnnouncementsParams
>;
export const AdminListAnnouncementsParams = createSelectParams().merge(
  z.object({
    q: z.string().trim().max(100).optional(),
    activo: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
);

export type AdminCreateAnnouncementType = z.infer<
  typeof AdminCreateAnnouncement
>;
export const AdminCreateAnnouncement = z
  .object({
    nombre: z.string().trim().min(1).max(120),
    texto: z.string().trim().min(1).max(MAX_TEXTO_LENGTH),
    link: link.optional(),
    icono: icono.optional(),
    posicion_icono: z.enum(ANNOUNCEMENT_ICON_POSITIONS).optional(),
    fecha_inicio: fecha.optional(),
    fecha_fin: fecha.optional(),
    activo: z.boolean().optional(),
  })
  .strict();

export type AdminUpdateAnnouncementType = z.infer<
  typeof AdminUpdateAnnouncement
>;
export const AdminUpdateAnnouncement = AdminCreateAnnouncement.partial();

export type AdminUpdateAnnouncementSettingsType = z.infer<
  typeof AdminUpdateAnnouncementSettings
>;
export const AdminUpdateAnnouncementSettings = z
  .object({
    intervalo_segundos: z
      .number()
      .int()
      .min(MIN_INTERVALO_SEGUNDOS)
      .max(MAX_INTERVALO_SEGUNDOS)
      .optional(),
    lugares: z
      .array(z.enum(ANNOUNCEMENT_PLACES))
      .transform((values) => Array.from(new Set(values)))
      .optional(),
    color_fondo: z.string().regex(HEX_COLOR).optional(),
    color_texto: z.string().regex(HEX_COLOR).optional(),
    color_borde: z.union([z.string().regex(HEX_COLOR), z.null()]).optional(),
  })
  .strict();
