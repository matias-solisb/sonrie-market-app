import { B2BCustomer } from "@/types"
import React from "react"

interface AccountLayoutProps {
  customer: B2BCustomer | null
  children: React.ReactNode
}

/*

Sin sidebar de navegación: la única navegación entre secciones de la
cuenta es el dropdown `AccountMenu` del header (Perfil/Pedidos/Documentos),
igual que en el sitio de referencia (sonrie.youorder.me). Antes acá vivía
`AccountNav` en una grilla 240px/1fr — se sacó a pedido explícito (no
mostrar ningún menú a la izquierda), así que el contenido ahora ocupa todo
el ancho disponible tanto con sesión como sin ella.

Nota: esto deja sin ningún link de navegación visible a las páginas
Company/Addresses/Quotes/Approvals del B2B Starter original (antes solo
alcanzables desde AccountNav) — siguen existiendo y son alcanzables por
URL directa, pero no aparecen en ningún menú. Si en algún momento se
vuelven a necesitar desde la UI, hay que agregarlas a `AccountMenu` o a
algún otro punto de navegación.

*/

const AccountLayout: React.FC<AccountLayoutProps> = async ({
  customer,
  children,
}) => {
  if (!customer) {
    return (
      <div
        className="flex min-h-[70vh] w-full flex-1 items-center justify-center"
        data-testid="account-page"
      >
        {children}
      </div>
    )
  }

  return (
    // Espacio entre el header del sitio y el contenido de la cuenta: antes
    // se sumaba `small:py-12` (afuera) + `py-12` (adentro) = 96px en
    // desktop. Quedó en un solo valor acá — para acercar o alejar "Mis
    // datos" del header, es este `py-6 small:py-8` el que hay que tocar
    // (py-6 = 24px en mobile, py-8 = 32px desde 1024px).
    <div className="flex-1" data-testid="account-page">
      <div className="flex-1 content-container h-full max-w-5xl mx-auto bg-white flex flex-col py-6 small:py-8">
        {children}
      </div>
    </div>
  )
}

export default AccountLayout
