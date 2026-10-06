import { Container, Heading, Text } from "@medusajs/ui";

/*

Cotizaciones del B2B Starter: DESACTIVADAS en Sonríe Market.

El backend responde 404 en /admin/quotes* salvo QUOTES_ENABLED=true
(src/api/middlewares/quotes-disabled.ts), así que esta página ya no aparece
en el menú lateral (sin `export const config = defineRouteConfig(...)`) y,
si alguien entra por URL directa, ve un aviso en vez de una tabla con error.

Para reactivarlas: QUOTES_ENABLED=true en el backend y restaurar esta página
desde git (versión del B2B Starter, con su `config` y <QuotesTable />).

*/
const Quotes = () => (
  <Container className="flex flex-col gap-y-2 p-6">
    <Heading>Cotizaciones desactivadas</Heading>
    <Text className="text-ui-fg-subtle">
      Las cotizaciones no están habilitadas en Sonríe Market.
    </Text>
  </Container>
);

export default Quotes;
