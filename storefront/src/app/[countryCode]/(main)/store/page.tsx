import { redirect } from "next/navigation"

// `/products` es ahora la ruta canónica del catálogo. Esta página se deja
// como un simple redirect por si queda algún enlace viejo apuntando a
// `/store` (favoritos, buscadores, etc.).
type Props = {
  params: Promise<{ countryCode: string }>
}

export default async function StorePage(props: Props) {
  const { countryCode } = await props.params

  redirect(`/${countryCode}/products`)
}
