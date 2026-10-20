import { z } from "zod";

export type AdminSetHabilitacionType = z.infer<typeof AdminSetHabilitacion>;
export const AdminSetHabilitacion = z
  .object({
    enabled: z.boolean(),
  })
  .strict();
