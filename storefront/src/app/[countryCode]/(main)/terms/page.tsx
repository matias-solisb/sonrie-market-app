import TermsTemplate from "@/modules/terms/templates"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Términos y condiciones",
}

export default function TermsPage() {
  return <TermsTemplate />
}
