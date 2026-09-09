import ResetPasswordForm from "@/modules/account/components/reset-password"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Nueva contraseña",
  description: "Define una contraseña nueva para tu cuenta de Sonríe Market.",
}

type Props = {
  // El link del correo (armado en
  // backend/src/subscribers/customer-password-reset.ts) apunta acá con
  // ?token=<jwt>. Sin token no hay forma de completar el flujo — ver el
  // estado "Link no válido" en ResetPasswordForm.
  searchParams: Promise<{ token?: string }>
}

// Ver el comentario en recover-password/page.tsx sobre por qué esta
// vista vive fuera de `account/`.
export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams

  return (
    <div className="flex w-full justify-center px-4 py-10 sm:px-8 sm:py-14">
      <ResetPasswordForm token={token} />
    </div>
  )
}
