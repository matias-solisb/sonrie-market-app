import Footer from "@/modules/layout/templates/footer"
import { NavigationHeader } from "@/modules/layout/templates/nav"

// Layout del checkout: mismo header y footer que el resto de la tienda
// (logo, buscador, cuenta, carrito y barra roja de categorías), para que
// carrito → checkout → pedido confirmado se vean como un solo recorrido.
export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full bg-white relative small:min-h-screen">
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
