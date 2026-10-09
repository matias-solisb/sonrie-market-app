import { SONRIE_LOGO_URL } from "@/lib/constants"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Image from "next/image"

// Layout del checkout: solo el logo (sin buscador ni menús) para que el
// colaborador se enfoque en confirmar el pedido.
export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full bg-white relative small:min-h-screen">
      <div className="h-16 bg-white border-b border-ui-border-base">
        <nav className="flex h-full items-center content-container justify-between">
          <LocalizedClientLink href="/" className="flex items-center">
            <Image
              src={SONRIE_LOGO_URL}
              alt="Sonríe Market"
              width={180}
              height={48}
              className="h-10 w-auto"
              priority
            />
          </LocalizedClientLink>
        </nav>
      </div>
      <div
        className="relative bg-[#FBF8F4] min-h-[calc(100vh-4rem)]"
        data-testid="checkout-container"
      >
        {children}
      </div>
    </div>
  )
}
