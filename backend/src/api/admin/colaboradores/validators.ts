import { z } from "zod";

export type AdminSetHabilitacionType = z.infer<typeof AdminSetHabilitacion>;
export const AdminSetHabilitacion = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

/*
Alta de colaborador desde el Admin. Solo forma: el RUT (DV) y el correo los
valida src/utils/colaborador-alta.ts, igual que en el script.
*/
export type AdminAltaColaboradorType = z.infer<typeof AdminAltaColaborador>;
export const AdminAltaColaborador = z
  .object({
    rut: z.string().trim().min(1).max(20),
    email: z.string().trim().min(1).max(254),
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(30).nullish(),
  })
  .strict();
