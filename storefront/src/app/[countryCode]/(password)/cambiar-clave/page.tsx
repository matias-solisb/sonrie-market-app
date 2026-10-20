import { retrievePasswordChangeRequired } from "@/lib/data/customer"
import ForcedPasswordChange from "@/modules/account/components/forced-password-change"
import { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Cambia tu contraseña",
  description: "Define tu contraseña para empezar a usar Sonríe Market.",
}

type Props = {
  params: Promise<{ countryCode: string }>
}

/*

Cambio de clave obligatorio del primer ingreso (rut-auth, paso 6).

Vive en su propio route group `(password)`, fuera de `(main)` y
`(checkout)`, a propósito: esos layouts cargan el carrito y la navegación
(que el backend bloquea mientras el cambio esté pendiente) y además
redirigen acá. Desde aquí no se puede navegar a la tienda hasta cambiar la
clave.

- Sin sesión → al login.
- Sin cambio pendiente → a la tienda (alguien entró a la URL a mano).

*/
export default async function CambiarClavePage({ params }: Props) {
  const { countryCode } = await params
  const required = await retrievePasswordChangeRequired()

  if (required === null) {
    redirect(`/${countryCode}/account`)
  }

  if (required === false) {
    redirect(`/${countryCode}`)
  }

  return (
    <div className="flex w-full justify-center px-4 py-10 sm:px-8 sm:py-14">
      <ForcedPasswordChange countryCode={countryCode} />
    </div>
  )
}
