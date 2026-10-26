import { Container, Heading, Text } from "@medusajs/ui";

/*

Aprobaciones del B2B Starter: DESACTIVADAS en Sonríe Market (fuera del MVP,
Fase 2e del roadmap).

El backend responde 404 en /admin/approvals* salvo APPROVALS_ENABLED=true
(src/api/middlewares/approvals-disabled.ts), así que esta página ya no
aparece en el menú lateral (sin `export const config = defineRouteConfig(...)`)
y, si alguien entra por URL directa, ve un aviso en vez de una tabla con error.

Para reactivarlas: ver los requisitos en approvals-disabled.ts, poner
APPROVALS_ENABLED=true en el backend y restaurar esta página desde git
(versión del B2B Starter, con su `config` y <ApprovalsTable />).

*/
const Approvals = () => (
  <Container className="flex flex-col gap-y-2 p-6">
    <Heading>Aprobaciones desactivadas</Heading>
    <Text className="text-ui-fg-subtle">
      Las aprobaciones de pedidos no están habilitadas en Sonríe Market.
    </Text>
  </Container>
);

export default Approvals;
