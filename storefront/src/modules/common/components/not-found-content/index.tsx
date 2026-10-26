import Link from "next/link"

/*

Contenido de la página 404 (título, texto y botón "Ir a Inicio"), igual al
del sitio de referencia (sonrie.youorder.me). Lo usan las dos 404 del
storefront para que el colaborador vea siempre la misma página:

- app/not-found.tsx: URLs que no calzan con ninguna ruta. Agrega su propio
  header minimalista porque no hereda el layout del sitio.
- app/[countryCode]/(main)/not-found.tsx: cuando una página de la tienda
  llama a notFound() (producto inexistente, pedido ajeno, etc.). Se muestra
  dentro del layout normal (barra roja, buscador, carrito).

*/
export default function NotFoundContent({
  className = "",
}: {
  className?: string
}) {
  return (
    <div
      className={`flex flex-1 flex-col items-center px-6 text-center ${className}`}
      data-testid="not-found-content"
    >
      <h1 className="text-2xl-semi text-ui-fg-base sm:text-3xl-semi">
        ¡Lo siento, página no encontrada!
      </h1>
      <p className="mt-4 max-w-md text-base-regular text-ui-fg-subtle">
        Lo sentimos, no pudimos encontrar la página que estás buscando.
        ¿Quizás has escrito mal la URL? Asegúrate de revisar tu ortografía.
      </p>

      <Link
        href="/"
        className="mt-12 flex h-11 items-center justify-center rounded-md bg-gray-900 px-8 font-semibold text-white hover:bg-gray-800"
        data-testid="not-found-home-link"
      >
        Ir a Inicio
      </Link>
    </div>
  )
}
