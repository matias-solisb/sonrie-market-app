import { defineRouteConfig } from "@medusajs/admin-sdk";
import { CurrencyDollar } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Table,
  Text,
  toast,
  Toaster,
  usePrompt,
} from "@medusajs/ui";
import { useState } from "react";
import {
  AdminBenefitCampaign,
  AdminBenefitCampaignChange,
  useBenefitCampaignChanges,
  useBenefitCampaigns,
  useUpdateBenefitCampaign,
} from "../../hooks/api/benefit-budget";

/*

Página "Beneficio" del Admin: tope mensual de la campaña de beneficio y su
historial de cambios (documento técnico §8: "campañas/topes" es del Admin
funcional Soprole; especificación §7.2: los topes se configuran en la UI
del Admin; addendum §3.7: el ensayo del mes 4 incluye un cambio de tope).

Un tope nuevo rige desde el mes siguiente: los saldos del mes en curso ya
se abrieron con el tope anterior (ver update-benefit-campaign.ts). Para
cambiar el tope de una persona en el mes en curso está la excepción del
widget en el detalle del cliente.

MVP: una sola campaña mensual. Crear campañas, rangos de fechas y reglas
por producto son de la Fase 2.

*/

const clp = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);

/** "2026-11" → "noviembre de 2026" */
const mes = (periodo: string) => {
  const [y, m] = periodo.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santiago",
  });

const CAMPOS: Record<string, string> = {
  tope_por_colaborador: "Tope",
  nombre: "Nombre",
  descripcion: "Descripción",
  estado: "Estado",
};

const valor = (campo: string, v: unknown) =>
  v === null || v === undefined || v === ""
    ? "—"
    : campo === "tope_por_colaborador"
      ? clp(Number(v))
      : String(v);

const quien = (actor: AdminBenefitCampaignChange["actor"]) => {
  if (!actor) return "Sistema";
  const nombre = [actor.first_name, actor.last_name].filter(Boolean).join(" ");
  return nombre || actor.email || actor.id;
};

const CambiarTopeDrawer = ({
  campaign,
  periodoActual,
  periodoSiguiente,
  topeActual,
}: {
  campaign: AdminBenefitCampaign;
  periodoActual: string;
  periodoSiguiente: string;
  /** Tope del mes en curso (distinto del de la campaña si hay un cambio programado). */
  topeActual: number;
}) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const prompt = usePrompt();
  const { mutateAsync, isPending } = useUpdateBenefitCampaign(campaign.id);

  const nuevo = Number(value);
  const valido =
    value.trim() !== "" && Number.isInteger(nuevo) && nuevo >= 0;
  const cambia = valido && nuevo !== campaign.tope_por_colaborador;

  const handleSave = async () => {
    if (!cambia) return;

    const ok = await prompt({
      title: "Cambiar el tope del beneficio",
      description: `El tope pasa de ${clp(
        campaign.tope_por_colaborador
      )} a ${clp(nuevo)} para todos los colaboradores, desde ${mes(
        periodoSiguiente
      )}. ¿Confirmas?`,
      confirmText: "Cambiar tope",
      cancelText: "Cancelar",
    });

    if (!ok) return;

    try {
      const { rige_desde } = await mutateAsync({
        tope_por_colaborador: nuevo,
      });
      toast.success(
        `Tope actualizado a ${clp(nuevo)}${
          rige_desde ? `: rige desde ${mes(rige_desde)}` : ""
        }.`
      );
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cambiar el tope.");
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValue(String(campaign.tope_por_colaborador));
      }}
    >
      <Drawer.Trigger asChild>
        <Button size="small" variant="secondary">
          Cambiar tope
        </Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Cambiar el tope mensual</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="tope-campana" size="small" weight="plus">
              Tope por colaborador (CLP, con IVA)
            </Label>
            <Input
              id="tope-campana"
              type="number"
              min={0}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {!valido && value !== "" && (
              <Text size="small" className="text-ui-fg-error">
                Ingresa un monto entero mayor o igual a 0.
              </Text>
            )}
          </div>

          <div className="bg-ui-bg-subtle flex flex-col gap-y-2 rounded-md p-4">
            <Text size="small" weight="plus">
              {cambia
                ? `${clp(nuevo)} rige desde el 1 de ${mes(periodoSiguiente)}.`
                : `Un tope nuevo rige desde el 1 de ${mes(periodoSiguiente)}.`}
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              El mes en curso ({mes(periodoActual)}) mantiene{" "}
              {clp(topeActual)} para quienes ya tienen su
              saldo del mes abierto, que son todos los colaboradores desde el
              día 1. Un alta nueva que aún no tenga saldo este mes recibe el
              tope nuevo de inmediato.
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              Para cambiar el tope de una persona en el mes en curso, usa la
              excepción en el detalle del cliente (sección Beneficio).
            </Text>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">
              Cancelar
            </Button>
          </Drawer.Close>
          <Button
            size="small"
            onClick={handleSave}
            disabled={!cambia}
            isLoading={isPending}
          >
            Guardar
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

const Historial = ({ campaignId }: { campaignId: string }) => {
  const { data, isPending } = useBenefitCampaignChanges(campaignId);
  const cambios = data?.cambios ?? [];

  return (
    <Container className="flex flex-col p-0 overflow-hidden">
      <div className="p-6 pb-4">
        <Heading level="h2">Historial de cambios</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Quién cambió la campaña, cuándo y qué valores tenía antes.
        </Text>
      </div>

      {isPending ? (
        <Text size="small" className="px-6 pb-6">
          Cargando...
        </Text>
      ) : cambios.length === 0 ? (
        <Text size="small" className="px-6 pb-6 text-ui-fg-subtle">
          Todavía no hay cambios registrados.
        </Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Fecha</Table.HeaderCell>
              <Table.HeaderCell>Usuario</Table.HeaderCell>
              <Table.HeaderCell>Cambio</Table.HeaderCell>
              <Table.HeaderCell>Rige desde</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {cambios.map((c) => (
              <Table.Row key={c.id}>
                <Table.Cell>{fechaHora(c.created_at)}</Table.Cell>
                <Table.Cell>{quien(c.actor)}</Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col py-2">
                    {Object.entries(c.cambios).map(([campo, v]) => (
                      <span key={campo}>
                        {CAMPOS[campo] ?? campo}: {valor(campo, v.anterior)} →{" "}
                        {valor(campo, v.nuevo)}
                      </span>
                    ))}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {c.rige_desde ? mes(c.rige_desde) : "Inmediato"}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  );
};

/**
 * Si el tope se cambió durante el mes en curso, el mes en curso sigue con el
 * tope anterior: el `anterior` del PRIMER cambio de tope con rige_desde =
 * mes siguiente. Devuelve ese monto, o null si no hay cambio pendiente.
 */
const topeMesEnCurso = (
  cambios: AdminBenefitCampaignChange[] | undefined,
  periodoSiguiente: string | undefined
): number | null => {
  const pendientes = (cambios ?? []).filter(
    (c) => c.rige_desde === periodoSiguiente && c.cambios.tope_por_colaborador
  );
  const primero = pendientes[pendientes.length - 1]; // la lista viene DESC

  return primero
    ? Number(primero.cambios.tope_por_colaborador.anterior)
    : null;
};

const BenefitBudgetPage = () => {
  const { data, isPending, error } = useBenefitCampaigns();
  const active = data?.campaigns.find(
    (c) => c.estado === "activa" && c.periodo === "mensual"
  );
  const { data: historial } = useBenefitCampaignChanges(active?.id);
  const topeActual = topeMesEnCurso(
    historial?.cambios,
    data?.periodo_siguiente
  );

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex flex-col gap-y-4 p-6">
        <div className="flex items-start justify-between gap-x-4">
          <div>
            <Heading className="font-sans font-medium h1-core">
              Beneficio
            </Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Cupo mensual de compra por colaborador. Se reinicia cada mes
              (hora de Chile) y no es acumulable.
            </Text>
          </div>
          {active && data && (
            <CambiarTopeDrawer
              campaign={active}
              periodoActual={data.periodo_actual}
              periodoSiguiente={data.periodo_siguiente}
              topeActual={topeActual ?? active.tope_por_colaborador}
            />
          )}
        </div>

        {isPending && <Text size="small">Cargando...</Text>}

        {error && (
          <Text size="small" className="text-ui-fg-error">
            No se pudo cargar la campaña: {error.message}
          </Text>
        )}

        {!isPending && !error && !active && (
          <Text size="small" className="text-ui-fg-error">
            No hay una campaña de beneficio activa: los colaboradores no
            pueden completar compras.
          </Text>
        )}

        {active && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">
            <dt className="text-ui-fg-subtle">Campaña</dt>
            <dd>{active.nombre}</dd>
            <dt className="text-ui-fg-subtle">Tope por colaborador</dt>
            <dd className="font-medium">
              {topeActual !== null &&
              topeActual !== active.tope_por_colaborador &&
              data ? (
                <div className="flex flex-col">
                  <span>
                    {clp(topeActual)} en {mes(data.periodo_actual)}
                  </span>
                  <span className="flex items-center gap-x-2">
                    {clp(active.tope_por_colaborador)} desde{" "}
                    {mes(data.periodo_siguiente)}
                    <Badge size="2xsmall" color="orange">
                      Cambio programado
                    </Badge>
                  </span>
                </div>
              ) : (
                clp(active.tope_por_colaborador)
              )}
            </dd>
            <dt className="text-ui-fg-subtle">Periodo</dt>
            <dd>Mensual · vigente: {data && mes(data.periodo_actual)}</dd>
            <dt className="text-ui-fg-subtle">Estado</dt>
            <dd>
              <Badge size="2xsmall" color="green">
                Activa
              </Badge>
            </dd>
          </dl>
        )}
      </Container>

      {active && <Historial campaignId={active.id} />}

      <Toaster />
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Beneficio",
  icon: CurrencyDollar,
});

export default BenefitBudgetPage;
