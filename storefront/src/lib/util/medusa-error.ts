import { translateMedusaError } from "./translate-medusa-error"

/*

Convierte el error de una llamada al backend en un Error con un mensaje
listo para mostrar al colaborador (en español, sin prefijos técnicos).

El SDK de Medusa lanza un FetchError cuyo `message` ya es el mensaje del
backend; el detalle técnico queda en el log del servidor.

Ojo: en producción Next.js reemplaza el mensaje de los errores lanzados
por una server action. Para mostrarlo en pantalla la acción tiene que
devolver `{ error }` (ver lib/data/cart.ts) en vez de lanzar.

*/
export default function medusaError(error: any): never {
  if (error?.response) {
    // Cliente estilo axios: el backend respondió con un código fuera de 2xx.
    const data = error.response.data
    const message = data?.message || data

    console.warn("Error del backend:", error.response.status, message)

    throw new Error(translateMedusaError(`${message}`))
  }

  console.warn("Error del backend:", error?.status ?? "", error?.message)

  throw new Error(translateMedusaError(error?.message))
}
