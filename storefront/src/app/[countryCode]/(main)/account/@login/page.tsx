import { Metadata } from "next"

import LoginTemplate from "@/modules/account/templates/login-template"

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Inicia sesión en tu cuenta de Sonríe Market.",
}

type Props = {
  // Cuando el middleware redirige acá por falta de sesión (home o catálogo
  // protegidos), viene con ?redirect_to=<ruta original> para volver ahí
  // después de loguearse.
  searchParams: Promise<{ redirect_to?: string }>
}

export default async function Login({ searchParams }: Props) {
  const { redirect_to } = await searchParams

  return <LoginTemplate redirectTo={redirect_to} />
}
