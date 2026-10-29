import { listAnnouncements } from "@/lib/data/announcements"
import { enforceAccountState } from "@/lib/data/customer"
import AnnouncementBar from "@/modules/layout/components/announcement-bar"
import Footer from "@/modules/layout/templates/footer"
import { NavigationHeader } from "@/modules/layout/templates/nav"

// Layout del checkout: mismo header y footer que el resto de la tienda
// (logo, buscador, cuenta, carrito y barra roja de categorías), para que
// carrito → checkout → pedido confirmado se vean como un solo recorrido.
export default async function CheckoutLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  // Igual que en (main)/layout.tsx: con la cuenta deshabilitada o sin
  // cambiar la clave inicial no se llega al checkout (rut-auth, pasos 6 y 9).
  const { countryCode } = await params
  await enforceAccountState(countryCode)
  const announcements = await listAnnouncements()

  return (
    <div className="w-full bg-white relative small:min-h-screen">
      {/* El checkout siempre tiene sesión (enforceAccountState). */}
      <AnnouncementBar data={announcements} isLoggedIn />
      <NavigationHeader />
      <div
        className="relative bg-white min-h-[calc(100vh-4rem)]"
        data-testid="checkout-container"
      >
        {children}
      </div>
      <Footer />
    </div>
  )
}
