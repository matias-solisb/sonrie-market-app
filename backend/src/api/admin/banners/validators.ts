import { createSelectParams } from "@medusajs/medusa/api/utils/validators";
import { z } from "zod";

export type AdminGetBannerParamsType = z.infer<typeof AdminGetBannerParams>;
export const AdminGetBannerParams = createSelectParams();

export type AdminCreateBannerType = z.infer<typeof AdminCreateBanner>;
export const AdminCreateBanner = z
  .object({
    image_url: z.string(),
    orden: z.number().optional(),
    activo: z.boolean().optional(),
  })
  .strict();

export type AdminUpdateBannerType = z.infer<typeof AdminUpdateBanner>;
export const AdminUpdateBanner = z
  .object({
    image_url: z.string().optional(),
    orden: z.number().optional(),
    activo: z.boolean().optional(),
  })
  .strict();

// El panel manda el array completo de IDs en el nuevo orden visual
// (drag-and-drop); el backend traduce eso a los enteros de `orden`.
export type AdminReorderBannersType = z.infer<typeof AdminReorderBanners>;
export const AdminReorderBanners = z
  .object({
    ids: z.array(z.string()).min(1),
  })
  .strict();
