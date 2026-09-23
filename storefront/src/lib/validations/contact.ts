import { z } from "zod"

import {
  optionalString,
  requiredEmail,
  requiredString,
} from "@/lib/validations/common"

// Formulario de /contact. A diferencia del legacy, "Correo" es obligatorio
// y "Nombre" tiene su propio mensaje (el legacy decía "El Correo es
// requerido" en Nombre por un error de copia).
export const contactSchema = z.object({
  name: requiredString("Nombre"),
  email: requiredEmail(),
  phone: optionalString(),
  message: requiredString("Mensaje"),
})

export type ContactFormValues = z.infer<typeof contactSchema>
