/*

Convierte los valores ya validados de react-hook-form en un `FormData`
para poder llamar a los server actions existentes (`lib/data/*`), que
leen sus datos con `formData.get(...)`. Así los formularios validan en el
cliente con zod sin tener que cambiar la firma de ningún server action.

`undefined`/`null` se omiten (igual que un input vacío que el navegador
no manda); el resto se serializa con `String()`.

*/
export const toFormData = (
  values: Record<string, unknown>
): FormData => {
  const formData = new FormData()

  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    formData.append(key, String(value))
  })

  return formData
}
