import { z } from "zod"

import { requiredString } from "@/lib/validations/common"

// "Editar Datos" en /account/profile (ProfileCard). El teléfono se guarda
// como `+<código país><número>`; acá solo se valida la parte local.
export const profileSchema = z.object({
  first_name: requiredString("Nombre"),
  last_name: requiredString("Apellido"),
  phone_country: z.string(),
  phone_local: z
    .string()
    .trim()
    .regex(/^\d*$/, "Ingresa solo números")
    .optional(),
})

export type ProfileFormValues = z.infer<typeof profileSchema>
