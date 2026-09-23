import FaqTemplate from "@/modules/faq/templates"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
}

export default function FaqPage() {
  return <FaqTemplate />
}
