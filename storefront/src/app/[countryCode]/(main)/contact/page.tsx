import ContactTemplate from "@/modules/contact/templates"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contacto",
}

export default function ContactPage() {
  return <ContactTemplate />
}
