import RecoverPasswordForm from "@/modules/account/components/recover-password"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Recupera el acceso a tu cuenta de Sonríe Market.",
}

/*

Vive fuera de `account/` (que usa parallel routes `@dashboard`/`@login`,
ver `account/layout.tsx`) a propósito: ese layout solo sabe renderizar
esos dos slots según haya o no sesión, así que agregar una ruta más
adentro (`account/recover-password`) necesitaría un `default.tsx` para
cada slot en ese subpath — más frágil que sacar esta vista (y
`reset-password`, el paso 2) como rutas hermanas de `account/`, sin
tocar esa estructura para nada.

Mismo wrapper centrado que usa `login-template.tsx` para la card de
Login, para que se vea como parte del mismo flujo.

*/
export default function RecoverPasswordPage() {
  return (
    <div className="flex w-full justify-center px-4 py-10 sm:px-8 sm:py-14">
      <RecoverPasswordForm />
    </div>
  )
}
