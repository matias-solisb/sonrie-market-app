import { z } from "zod"

/*

Reglas de validación reutilizables para los esquemas zod de los
formularios. Centralizan los mensajes en español para que todos los
formularios digan lo mismo ("El Nombre es requerido", etc.).

Todas (salvo las de contraseña) hacen `trim()`, así un campo con solo espacios cuenta como vacío.

*/
export const requiredString = (label: string) =>
  z.string().trim().min(1, `El ${label} es requerido`)

/** Variante femenina: "La Contraseña es requerida". */
export const requiredStringF = (label: string) =>
  z.string().trim().min(1, `La ${label} es requerida`)

export const optionalString = () => z.string().trim().optional()

export const requiredEmail = (label = "Correo") =>
  requiredString(label).email("Debe ser un email válido")

export const optionalEmail = () =>
  z
    .string()
    .trim()
    .email("Debe ser un email válido")
    .or(z.literal(""))
    .optional()

export const PASSWORD_MIN_LENGTH = 8

/**
 * Contraseña: requerida pero SIN `trim()` — los espacios pueden ser parte
 * de una contraseña válida.
 */
export const requiredPassword = (label = "Contraseña") =>
  z.string().min(1, `La ${label} es requerida`)

/** Contraseña nueva: requerida y con largo mínimo. */
export const newPassword = (label = "Contraseña") =>
  requiredPassword(label).min(
    PASSWORD_MIN_LENGTH,
    `Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
  )
