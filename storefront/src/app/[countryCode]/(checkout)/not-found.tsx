import NotFoundContent from "@/modules/common/components/not-found-content"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "404",
  description: "Página no encontrada",
}

// 404 dentro del checkout. Mismo contenido que la 404 raíz (app/not-found.tsx);
// antes era la del B2B Starter, en inglés.
export default function NotFound() {
  return <NotFoundContent className="min-h-[calc(100vh-64px)] py-16" />
}
