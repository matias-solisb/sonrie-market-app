import ContactForm from "@/modules/contact/components/contact-form"

/*

Vista de /contact: formulario a la izquierda y datos de Sonríe Market a
la derecha (en mobile se apilan). El formulario vive en `components/contact-form`
(client component: MUI TextField + react-hook-form + zod).

*/
const ContactTemplate = () => {
  return (
    <div className="content-container py-6" data-testid="contact-page">
      <h1 className="border-b border-ui-border-base pb-6 text-3xl font-semibold text-ui-fg-base">
        Contacto
      </h1>

      <div className="grid grid-cols-1 gap-8 pt-9 small:grid-cols-2">
        <ContactForm />

        <div className="pt-1">
          <h2 className="text-2xl font-semibold uppercase text-ui-fg-base">
            Sonríe Market
          </h2>
        </div>
      </div>
    </div>
  )
}

export default ContactTemplate
