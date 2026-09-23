import { z } from "zod"

import {
  newPassword,
  requiredEmail,
  requiredPassword,
} from "@/lib/validations/common"

export const loginSchema = z.object({
  email: requiredEmail(),
  password: requiredPassword(),
})
export type LoginFormValues = z.infer<typeof loginSchema>

export const recoverPasswordSchema = z.object({
  email: requiredEmail(),
})
export type RecoverPasswordFormValues = z.infer<typeof recoverPasswordSchema>

// Reglas de contraseña nueva + repetición, compartidas por "restablecer
// contraseña" (link del correo) y "cambiar contraseña" (perfil). El
// servidor vuelve a comparar ambas en `resetPassword`, esto solo adelanta
// el error al cliente y lo muestra en el campo correcto.
const passwordsMatch = <T extends { password: string; repeat_password: string }>(
  values: T
) => values.password === values.repeat_password

const MISMATCH = {
  message: "Las contraseñas no coinciden",
  path: ["repeat_password"],
}

export const resetPasswordSchema = z
  .object({
    password: newPassword("Contraseña nueva"),
    repeat_password: requiredPassword("Contraseña"),
  })
  .refine(passwordsMatch, MISMATCH)
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export const changePasswordSchema = z
  .object({
    current_password: requiredPassword("Contraseña actual"),
    password: newPassword("Contraseña nueva"),
    repeat_password: requiredPassword("Contraseña"),
  })
  .refine(passwordsMatch, MISMATCH)
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
