import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { AdminCustomer, DetailWidgetProps } from "@medusajs/framework/types";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Table,
  Text,
  toast,
} from "@medusajs/ui";
import { useEffect, useState } from "react";
import {
  useCustomerBenefitBudget,
  useSetBenefitTopeOverride,
} from "../hooks/api/benefit-budget";

/*

Widget "Beneficio" en el detalle del cliente (Admin → Clientes → detalle).

Muestra el saldo del colaborador en un periodo (por defecto el vigente, en
hora de Santiago), sus movimientos (consumos y reintegros con el número de
pedido) y permite fijar o quitar la excepción de tope para ese periodo.

Datos: GET /admin/benefit-budget/customers/:id
Override: POST /admin/benefit-budget/customers/:id/override

*/

const clp = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);

const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santiago",
  }).format(new Date(iso));

const CustomerBenefitBudgetWidget = ({
  data: customer,
}: DetailWidgetProps<AdminCustomer>) => {
  const [periodo, setPeriodo] = useState<string | undefined>(undefined);
  const { data, isLoading, isError } = useCustomerBenefitBudget(
    customer.id,
    periodo
  );
  const budget = data?.benefit_budget ?? null;

  const [override, setOverride] = useState("");

  useEffect(() => {
    setOverride(
      budget?.tope_override !== null && budget?.tope_override !== undefined
        ? String(budget.tope_override)
        : ""
    );
  }, [budget?.tope_override, budget?.periodo]);

  const { mutateAsync, isPending } = useSetBenefitTopeOverride(customer.id);

  const save = async (value: number | null) => {
    try {
      await mutateAsync({ periodo: budget?.periodo, tope_override: value });
      toast.success(
        value === null
          ? "Se quitó la excepción de tope."
          : `Tope del periodo fijado en ${clp(value)}.`
      );
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar el tope.");
    }
  };

  const onSave = () => {
    const value = Number(override);

    if (!override.trim() || !Number.isInteger(value) || value < 0) {
      toast.error("Ingresa un monto entero mayor o igual a 0.");
      return;
    }

    save(value);
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Beneficio</Heading>
          {budget && (
            <Text size="small" className="text-ui-fg-subtle">
              {budget.campaign_nombre}
            </Text>
          )}
        </div>
        <Input
          type="month"
          size="small"
          className="w-40"
          value={periodo ?? budget?.periodo ?? ""}
          onChange={(e) => setPeriodo(e.target.value || undefined)}
          aria-label="Periodo"
        />
      </div>

      {isLoading && (
        <Text className="px-6 py-4 text-ui-fg-subtle">Cargando…</Text>
      )}

      {isError && (
        <Text className="px-6 py-4 text-ui-fg-error">
          No se pudo cargar el saldo de beneficio.
        </Text>
      )}

      {!isLoading && !isError && !budget && (
        <Text className="px-6 py-4 text-ui-fg-subtle">
          No hay una campaña de beneficio activa.
        </Text>
      )}

      {budget && (
        <>
          <div className="grid grid-cols-3 gap-4 px-6 py-4">
            <div>
              <Text size="small" className="text-ui-fg-subtle">
                Tope {budget.tope_override !== null && <Badge size="2xsmall">Excepción</Badge>}
              </Text>
              <Text weight="plus">{clp(budget.tope)}</Text>
            </div>
            <div>
              <Text size="small" className="text-ui-fg-subtle">
                Consumido
              </Text>
              <Text weight="plus">{clp(budget.consumido)}</Text>
            </div>
            <div>
              <Text size="small" className="text-ui-fg-subtle">
                Disponible
              </Text>
              <Text weight="plus">{clp(budget.disponible)}</Text>
            </div>
          </div>

          <div className="flex flex-col gap-y-2 px-6 py-4">
            <Label size="small" htmlFor="benefit-override">
              Excepción de tope para {budget.periodo}
            </Label>
            <div className="flex items-center gap-x-2">
              <Input
                id="benefit-override"
                type="number"
                min={0}
                step={1}
                size="small"
                className="w-40"
                placeholder="Tope de la campaña"
                value={override}
                onChange={(e) => setOverride(e.target.value)}
              />
              <Button
                size="small"
                variant="secondary"
                onClick={onSave}
                isLoading={isPending}
              >
                Guardar
              </Button>
              {budget.tope_override !== null && (
                <Button
                  size="small"
                  variant="transparent"
                  onClick={() => save(null)}
                  disabled={isPending}
                >
                  Quitar excepción
                </Button>
              )}
            </div>
          </div>

          <div className="px-6 py-4">
            <Text size="small" weight="plus" className="mb-2">
              Movimientos del periodo
            </Text>
            {data?.movimientos.length ? (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Fecha</Table.HeaderCell>
                    <Table.HeaderCell>Tipo</Table.HeaderCell>
                    <Table.HeaderCell>Pedido</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">
                      Monto
                    </Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {data.movimientos.map((m) => (
                    <Table.Row key={m.id}>
                      <Table.Cell>{fecha(m.created_at)}</Table.Cell>
                      <Table.Cell>
                        <Badge
                          size="2xsmall"
                          color={m.tipo === "consumo" ? "orange" : "green"}
                        >
                          {m.tipo === "consumo" ? "Consumo" : "Reintegro"}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {m.order_id ? (
                          <a
                            href={`/app/orders/${m.order_id}`}
                            className="text-ui-fg-interactive hover:underline"
                          >
                            #{m.order_display_id ?? m.order_id}
                          </a>
                        ) : (
                          "—"
                        )}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {m.tipo === "consumo" ? "−" : "+"}
                        {clp(m.monto)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            ) : (
              <Text size="small" className="text-ui-fg-subtle">
                Sin movimientos en este periodo.
              </Text>
            )}
          </div>
        </>
      )}
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "customer.details.after",
});

export default CustomerBenefitBudgetWidget;
