import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Calendar, ExclamationCircle, PencilSquare, Trash } from "@medusajs/icons";
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Drawer,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Table,
  Tabs,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  fetchPickupBookingsOn,
  PickupChange,
  PickupException,
  PickupExceptionTipo,
  PickupOccupancyDay,
  PickupScheduleDay,
  PickupSettings,
  PickupSiteRow,
  useCreatePickupException,
  useDeletePickupException,
  useLoadPickupHolidays,
  usePickupChanges,
  usePickupConflicts,
  usePickupExceptions,
  usePickupHolidayYears,
  usePickupOccupancy,
  usePickupSites,
  useSetPickupScheduleDay,
  useUpdatePickupException,
  useUpdatePickupSettings,
  useUpdatePickupSite,
} from "../../hooks/api/pickup-scheduling";

/*

Página "Agenda de retiro" del Admin (módulo pickup-scheduling, paso 7 del
MVP; Documento técnico §7–8: "Configurar horario/capacidad por site" es del
Admin funcional Soprole y del Admin plataforma).

Pestañas:
- General: capacidad por defecto, anticipación (lead-time), horizonte y
  días que abren los sites sin horario propio.
- Sites: capacidad, anticipación y horizonte propios de cada site y su
  horario semanal (ej. sábado abierto con menos cupos).
- Calendario: feriados y excepciones por fecha; carga de los feriados
  nacionales de Chile (los irrenunciables no se pueden abrir).
- Ocupación: cupos tomados y libres de los próximos 14 días por site.
- Historial: quién cambió qué (auditoría).

Arriba de las pestañas se listan los pedidos agendados en días que hoy
están cerrados (se cerró el día o se cargó un feriado después de que el
colaborador eligió la fecha): cerrar un día no anula ni mueve pedidos, hay
que avisarles. Antes de cerrar un día con pedidos, la página pide
confirmación.

Los avisos usan `toast` sin un <Toaster /> propio: el Admin ya tiene uno
(con dos, cada aviso salía duplicado).

Un campo vacío en un site = usa el valor general. En el MVP cualquier
usuario del Admin puede editar la agenda (el RBAC llega en la Fase 2).
Los cambios no tocan los pedidos ya hechos: bajar la capacidad solo bloquea
reservas nuevas.

*/

const DIAS = [
  { n: 1, label: "Lunes", short: "Lun" },
  { n: 2, label: "Martes", short: "Mar" },
  { n: 3, label: "Miércoles", short: "Mié" },
  { n: 4, label: "Jueves", short: "Jue" },
  { n: 5, label: "Viernes", short: "Vie" },
  { n: 6, label: "Sábado", short: "Sáb" },
  { n: 7, label: "Domingo", short: "Dom" },
];

const diaLabel = (n: number) => DIAS.find((d) => d.n === n)?.label ?? String(n);

/** "2026-10-08" → "jue 8 oct 2026" (fecha de calendario, sin zona horaria). */
const fechaCorta = (fecha: string) =>
  new Date(`${fecha}T12:00:00Z`)
    .toLocaleDateString("es-CL", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .replace(/,/g, "");

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santiago",
  });

/** Año en curso en hora de Chile. */
const anioActual = () =>
  Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
    }).format(new Date())
  );

/** "" → null; "12" → 12; otro texto → NaN (inválido). */
const toCantidad = (value: string): number | null => {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
};

const isInvalid = (n: number | null) => n !== null && Number.isNaN(n);

const errorMessage = (e: any, fallback: string) => e?.message ?? fallback;

const Field = ({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-y-1">
    <Label htmlFor={id} size="small" weight="plus">
      {label}
    </Label>
    {children}
    {hint && (
      <Text size="small" className="text-ui-fg-subtle">
        {hint}
      </Text>
    )}
  </div>
);

type PromptFn = ReturnType<typeof usePrompt>;

/**
 * Antes de cerrar un día: si tiene pedidos agendados, pide confirmación
 * (cerrar no los anula ni los mueve). Devuelve false si el admin cancela.
 * Si la consulta falla, deja seguir: el aviso de pedidos en días cerrados
 * igual los va a mostrar.
 */
const confirmarCierre = async (
  prompt: PromptFn,
  fecha: string,
  stockLocationId: string | null,
  donde: string
) => {
  let pedidos = 0;

  try {
    pedidos = (await fetchPickupBookingsOn(fecha, stockLocationId)).bookings.length;
  } catch {
    return true;
  }

  if (!pedidos) return true;

  return prompt({
    title: "Hay pedidos agendados ese día",
    description: `${pedidos} ${
      pedidos === 1 ? "pedido tiene" : "pedidos tienen"
    } retiro el ${fechaCorta(fecha)} en ${donde}. Cerrar el día no los anula ni los mueve: hay que avisar a esos colaboradores. ¿Guardar igual?`,
    confirmText: "Guardar igual",
    cancelText: "Cancelar",
  });
};

// ─────────────────────────────────────────────────────────────────────
// General
// ─────────────────────────────────────────────────────────────────────

const GeneralTab = ({ settings }: { settings: PickupSettings }) => {
  const [capacidad, setCapacidad] = useState("");
  const [lead, setLead] = useState("");
  const [horizonte, setHorizonte] = useState("");
  const [dias, setDias] = useState<number[]>([]);
  const { mutateAsync, isPending } = useUpdatePickupSettings();

  useEffect(() => {
    setCapacidad(
      settings.capacidad_por_defecto === null
        ? ""
        : String(settings.capacidad_por_defecto)
    );
    setLead(String(settings.lead_time_dias));
    setHorizonte(String(settings.horizonte_dias));
    setDias(settings.dias_abiertos_por_defecto);
  }, [settings]);

  const cap = toCantidad(capacidad);
  const leadN = toCantidad(lead);
  const horN = toCantidad(horizonte);
  const invalido =
    isInvalid(cap) ||
    leadN === null ||
    isInvalid(leadN) ||
    horN === null ||
    isInvalid(horN) ||
    (horN as number) < (leadN as number);

  const toggleDia = (n: number, checked: boolean) =>
    setDias((prev) =>
      checked ? [...new Set([...prev, n])].sort((a, b) => a - b) : prev.filter((d) => d !== n)
    );

  const save = async () => {
    try {
      await mutateAsync({
        capacidad_por_defecto: cap,
        lead_time_dias: leadN as number,
        horizonte_dias: horN as number,
        dias_abiertos_por_defecto: dias,
      });
      toast.success("Configuración general guardada.");
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo guardar la configuración."));
    }
  };

  return (
    <div className="flex flex-col gap-y-6 p-6">
      {settings.capacidad_por_defecto === null && (
        <Text size="small" className="text-ui-fg-error">
          Sin capacidad por defecto: los sites que no tengan capacidad propia
          no ofrecen fechas de retiro y los colaboradores no pueden comprar.
        </Text>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field
          id="cap-general"
          label="Capacidad por defecto (pedidos por día y site)"
          hint="Vacío = sin configurar."
        >
          <Input
            id="cap-general"
            type="number"
            min={0}
            value={capacidad}
            onChange={(e) => setCapacidad(e.target.value)}
          />
        </Field>
        <Field
          id="lead-general"
          label="Anticipación mínima (días)"
          hint="1 = el colaborador puede retirar desde mañana."
        >
          <Input
            id="lead-general"
            type="number"
            min={0}
            value={lead}
            onChange={(e) => setLead(e.target.value)}
          />
        </Field>
        <Field
          id="hor-general"
          label="Horizonte (días hacia adelante)"
          hint="Hasta qué día se puede elegir, contado desde hoy."
        >
          <Input
            id="hor-general"
            type="number"
            min={0}
            value={horizonte}
            onChange={(e) => setHorizonte(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-y-2">
        <Label size="small" weight="plus">
          Días que abren los sites (si el site no tiene horario propio)
        </Label>
        <div className="flex flex-wrap gap-4">
          {DIAS.map((d) => (
            <div key={d.n} className="flex items-center gap-x-2">
              <Checkbox
                id={`dia-${d.n}`}
                checked={dias.includes(d.n)}
                onCheckedChange={(c) => toggleDia(d.n, c === true)}
              />
              <Label htmlFor={`dia-${d.n}`} size="small">
                {d.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {invalido && (
        <Text size="small" className="text-ui-fg-error">
          Revisa los valores: deben ser enteros mayores o iguales a 0, y el
          horizonte no puede ser menor que la anticipación.
        </Text>
      )}

      <div>
        <Button size="small" onClick={save} disabled={invalido} isLoading={isPending}>
          Guardar
        </Button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Sites
// ─────────────────────────────────────────────────────────────────────

type DayMode = "general" | "abierto" | "cerrado";

const heredado = (valor: number | null, general: number | null, unidad = "") =>
  valor !== null ? (
    <span>
      {valor}
      {unidad}
    </span>
  ) : (
    <span className="text-ui-fg-subtle">
      General ({general === null ? "sin configurar" : `${general}${unidad}`})
    </span>
  );

const horarioResumen = (horario: PickupScheduleDay[]) =>
  horario.length === 0 ? (
    <span className="text-ui-fg-subtle">General</span>
  ) : (
    <div className="flex flex-col py-2">
      {horario.map((h) => (
        <span key={h.dia_semana}>
          {DIAS.find((d) => d.n === h.dia_semana)?.short}:{" "}
          {h.abierto
            ? `abierto${h.capacidad !== null ? `, ${h.capacidad} cupos` : ""}`
            : "cerrado"}
        </span>
      ))}
    </div>
  );

const SiteDrawer = ({
  site,
  settings,
}: {
  site: PickupSiteRow;
  settings: PickupSettings;
}) => {
  const [open, setOpen] = useState(false);
  const [capacidad, setCapacidad] = useState("");
  const [lead, setLead] = useState("");
  const [horizonte, setHorizonte] = useState("");
  const [dias, setDias] = useState<Record<number, { mode: DayMode; capacidad: string }>>({});
  const [saving, setSaving] = useState(false);
  const updateSite = useUpdatePickupSite(site.id);
  const setDay = useSetPickupScheduleDay(site.id);

  const reset = () => {
    setCapacidad(site.config?.capacidad_diaria?.toString() ?? "");
    setLead(site.config?.lead_time_dias?.toString() ?? "");
    setHorizonte(site.config?.horizonte_dias?.toString() ?? "");
    setDias(
      Object.fromEntries(
        DIAS.map((d) => {
          const h = site.horario.find((x) => x.dia_semana === d.n);
          return [
            d.n,
            h
              ? {
                  mode: h.abierto ? "abierto" : "cerrado",
                  capacidad: h.capacidad?.toString() ?? "",
                }
              : { mode: "general", capacidad: "" },
          ];
        })
      ) as Record<number, { mode: DayMode; capacidad: string }>
    );
  };

  const cap = toCantidad(capacidad);
  const leadN = toCantidad(lead);
  const horN = toCantidad(horizonte);
  const diasInvalidos = DIAS.some(
    (d) => dias[d.n]?.mode === "abierto" && isInvalid(toCantidad(dias[d.n].capacidad))
  );
  const leadEf = leadN ?? settings.lead_time_dias;
  const horEf = horN ?? settings.horizonte_dias;
  const invalido =
    isInvalid(cap) || isInvalid(leadN) || isInvalid(horN) || diasInvalidos || horEf < leadEf;

  const save = async () => {
    setSaving(true);

    try {
      const config = { capacidad_diaria: cap, lead_time_dias: leadN, horizonte_dias: horN };
      const actual = site.config ?? {
        capacidad_diaria: null,
        lead_time_dias: null,
        horizonte_dias: null,
      };

      if (
        config.capacidad_diaria !== actual.capacidad_diaria ||
        config.lead_time_dias !== actual.lead_time_dias ||
        config.horizonte_dias !== actual.horizonte_dias
      ) {
        await updateSite.mutateAsync(config);
      }

      for (const d of DIAS) {
        const nuevo = dias[d.n];
        const previo = site.horario.find((h) => h.dia_semana === d.n);

        if (nuevo.mode === "general") {
          if (previo) await setDay.mutateAsync({ dia_semana: d.n, value: null });
          continue;
        }

        const value = {
          abierto: nuevo.mode === "abierto",
          capacidad: nuevo.mode === "abierto" ? toCantidad(nuevo.capacidad) : null,
        };

        if (
          !previo ||
          previo.abierto !== value.abierto ||
          previo.capacidad !== value.capacidad
        ) {
          await setDay.mutateAsync({ dia_semana: d.n, value });
        }
      }

      toast.success(`Agenda de ${site.name} guardada.`);
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo guardar el site."));
    } finally {
      setSaving(false);
    }
  };

  const generalAbre = (n: number) => settings.dias_abiertos_por_defecto.includes(n);

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <Drawer.Trigger asChild>
        <IconButton size="small" variant="transparent" aria-label={`Editar ${site.name}`}>
          <PencilSquare />
        </IconButton>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Agenda de {site.name}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
          <Text size="small" className="text-ui-fg-subtle">
            Deja un campo vacío para usar el valor general.
          </Text>
          <div className="grid grid-cols-1 gap-4">
            <Field id="site-cap" label="Capacidad diaria (pedidos por día)">
              <Input
                id="site-cap"
                type="number"
                min={0}
                value={capacidad}
                placeholder={`General: ${settings.capacidad_por_defecto ?? "sin configurar"}`}
                onChange={(e) => setCapacidad(e.target.value)}
              />
            </Field>
            <Field id="site-lead" label="Anticipación mínima (días)">
              <Input
                id="site-lead"
                type="number"
                min={0}
                value={lead}
                placeholder={`General: ${settings.lead_time_dias}`}
                onChange={(e) => setLead(e.target.value)}
              />
            </Field>
            <Field id="site-hor" label="Horizonte (días)">
              <Input
                id="site-hor"
                type="number"
                min={0}
                value={horizonte}
                placeholder={`General: ${settings.horizonte_dias}`}
                onChange={(e) => setHorizonte(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Horario semanal
            </Label>
            <Text size="small" className="text-ui-fg-subtle">
              "General" sigue los días de la configuración general. Un día
              abierto sin capacidad usa la capacidad del site.
            </Text>
            {DIAS.map((d) => {
              const value = dias[d.n] ?? { mode: "general", capacidad: "" };

              return (
                <div key={d.n} className="grid grid-cols-[90px_1fr_110px] items-center gap-2">
                  <Text size="small">{d.label}</Text>
                  <Select
                    value={value.mode}
                    onValueChange={(mode) =>
                      setDias((prev) => ({
                        ...prev,
                        [d.n]: { ...value, mode: mode as DayMode },
                      }))
                    }
                  >
                    <Select.Trigger aria-label={`Horario del ${d.label}`}>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="general">
                        General ({generalAbre(d.n) ? "abierto" : "cerrado"})
                      </Select.Item>
                      <Select.Item value="abierto">Abierto</Select.Item>
                      <Select.Item value="cerrado">Cerrado</Select.Item>
                    </Select.Content>
                  </Select>
                  {value.mode === "abierto" ? (
                    <Input
                      type="number"
                      min={0}
                      aria-label={`Capacidad del ${d.label}`}
                      placeholder="Cupos"
                      value={value.capacidad}
                      onChange={(e) =>
                        setDias((prev) => ({
                          ...prev,
                          [d.n]: { ...value, capacidad: e.target.value },
                        }))
                      }
                    />
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
          </div>

          {invalido && (
            <Text size="small" className="text-ui-fg-error">
              Revisa los valores: enteros mayores o iguales a 0, y el horizonte
              no puede ser menor que la anticipación.
            </Text>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">
              Cancelar
            </Button>
          </Drawer.Close>
          <Button size="small" onClick={save} disabled={invalido} isLoading={saving}>
            Guardar
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

const SitesTab = ({
  settings,
  sites,
}: {
  settings: PickupSettings;
  sites: PickupSiteRow[];
}) =>
  sites.length === 0 ? (
    <Text size="small" className="p-6 text-ui-fg-subtle">
      No hay sites de retiro configurados (backend: setup-pickup-sites.ts).
    </Text>
  ) : (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Site</Table.HeaderCell>
          <Table.HeaderCell>Capacidad diaria</Table.HeaderCell>
          <Table.HeaderCell>Anticipación</Table.HeaderCell>
          <Table.HeaderCell>Horizonte</Table.HeaderCell>
          <Table.HeaderCell>Horario propio</Table.HeaderCell>
          <Table.HeaderCell />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {sites.map((site) => (
          <Table.Row key={site.id}>
            <Table.Cell>{site.name}</Table.Cell>
            <Table.Cell>
              {heredado(site.config?.capacidad_diaria ?? null, settings.capacidad_por_defecto)}
            </Table.Cell>
            <Table.Cell>
              {heredado(site.config?.lead_time_dias ?? null, settings.lead_time_dias, " d")}
            </Table.Cell>
            <Table.Cell>
              {heredado(site.config?.horizonte_dias ?? null, settings.horizonte_dias, " d")}
            </Table.Cell>
            <Table.Cell>{horarioResumen(site.horario)}</Table.Cell>
            <Table.Cell className="text-right">
              <SiteDrawer site={site} settings={settings} />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );

// ─────────────────────────────────────────────────────────────────────
// Calendario (excepciones y feriados)
// ─────────────────────────────────────────────────────────────────────

const TIPOS: Record<PickupExceptionTipo, { label: string; color: "red" | "orange" | "green" }> = {
  feriado: { label: "Feriado", color: "red" },
  cerrado: { label: "Cerrado", color: "orange" },
  abierto: { label: "Abre", color: "green" },
};

const ALL_SITES = "__todos__";

const ExceptionDrawer = ({
  exception,
  sites,
  trigger,
}: {
  exception?: PickupException;
  sites: PickupSiteRow[];
  trigger: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState("");
  const [site, setSite] = useState(ALL_SITES);
  const [tipo, setTipo] = useState<PickupExceptionTipo>("cerrado");
  const [irrenunciable, setIrrenunciable] = useState(false);
  const [capacidad, setCapacidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const create = useCreatePickupException();
  const update = useUpdatePickupException();
  const prompt = usePrompt();

  const reset = () => {
    setFecha(exception?.fecha ?? "");
    setSite(exception?.stock_location_id ?? ALL_SITES);
    setTipo(exception?.tipo ?? "cerrado");
    setIrrenunciable(exception?.irrenunciable ?? false);
    setCapacidad(exception?.capacidad?.toString() ?? "");
    setMotivo(exception?.motivo ?? "");
  };

  const esGlobal = site === ALL_SITES;
  const puedeIrrenunciable = tipo === "feriado" && esGlobal;
  const puedeCapacidad = tipo === "abierto" && !esGlobal;
  const cap = puedeCapacidad ? toCantidad(capacidad) : null;
  const invalido = !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || isInvalid(cap);

  const save = async () => {
    const body = {
      fecha,
      stock_location_id: esGlobal ? null : site,
      tipo,
      irrenunciable: puedeIrrenunciable ? irrenunciable : false,
      capacidad: cap,
      motivo: motivo.trim() || null,
    };

    // Cerrar un día (nuevo cierre, o un cierre que cambia de fecha o site)
    // con pedidos agendados: confirmar antes.
    const cierra =
      tipo !== "abierto" &&
      (!exception ||
        exception.tipo === "abierto" ||
        exception.fecha !== body.fecha ||
        exception.stock_location_id !== body.stock_location_id);

    if (cierra) {
      const donde = esGlobal
        ? "todos los sites"
        : sites.find((s) => s.id === site)?.name ?? "el site";

      if (!(await confirmarCierre(prompt, fecha, body.stock_location_id, donde))) {
        return;
      }
    }

    try {
      if (exception) {
        await update.mutateAsync({ id: exception.id, ...body });
      } else {
        await create.mutateAsync(body);
      }
      toast.success(exception ? "Excepción actualizada." : "Excepción creada.");
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo guardar la excepción."));
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{exception ? "Editar excepción" : "Nueva excepción"}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4">
          <Field id="exc-fecha" label="Fecha">
            <Input
              id="exc-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field>
          <Field id="exc-site" label="Aplica a">
            <Select value={site} onValueChange={setSite}>
              <Select.Trigger id="exc-site">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={ALL_SITES}>Todos los sites</Select.Item>
                {sites.map((s) => (
                  <Select.Item key={s.id} value={s.id}>
                    {s.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>
          <Field
            id="exc-tipo"
            label="Tipo"
            hint={
              tipo === "abierto"
                ? "Abre aunque el horario o un feriado general digan lo contrario (no aplica a feriados irrenunciables)."
                : tipo === "feriado"
                  ? "Cierra por feriado."
                  : "Cierra por otro motivo (inventario, mantención…)."
            }
          >
            <Select value={tipo} onValueChange={(v) => setTipo(v as PickupExceptionTipo)}>
              <Select.Trigger id="exc-tipo">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="feriado">Feriado</Select.Item>
                <Select.Item value="cerrado">Cerrado</Select.Item>
                <Select.Item value="abierto">Abre (apertura especial)</Select.Item>
              </Select.Content>
            </Select>
          </Field>
          {puedeIrrenunciable && (
            <div className="flex items-center gap-x-2">
              <Checkbox
                id="exc-irr"
                checked={irrenunciable}
                onCheckedChange={(c) => setIrrenunciable(c === true)}
              />
              <Label htmlFor="exc-irr" size="small">
                Irrenunciable (ningún site puede abrir)
              </Label>
            </div>
          )}
          {puedeCapacidad && (
            <Field
              id="exc-cap"
              label="Capacidad ese día"
              hint="Vacío = la capacidad que corresponda al día."
            >
              <Input
                id="exc-cap"
                type="number"
                min={0}
                value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
              />
            </Field>
          )}
          <Field id="exc-motivo" label="Motivo" hint="Se muestra al colaborador si el día está cerrado.">
            <Input
              id="exc-motivo"
              maxLength={200}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Field>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">
              Cancelar
            </Button>
          </Drawer.Close>
          <Button
            size="small"
            onClick={save}
            disabled={invalido}
            isLoading={create.isPending || update.isPending}
          >
            Guardar
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

const CalendarioTab = ({ sites }: { sites: PickupSiteRow[] }) => {
  const [anio, setAnio] = useState(anioActual());
  const { data, isPending, error } = usePickupExceptions(`${anio}-01-01`, `${anio}-12-31`);
  const { data: years } = usePickupHolidayYears();
  const loadHolidays = useLoadPickupHolidays();
  const remove = useDeletePickupException();
  const prompt = usePrompt();
  const hayFeriados = years?.anios.includes(anio) ?? false;

  const cargarFeriados = async () => {
    const ok = await prompt({
      title: `Cargar feriados de Chile ${anio}`,
      description:
        "Se agregan los feriados nacionales como días cerrados para todos los sites. Los irrenunciables quedan marcados y ningún site podrá abrir esos días. Las fechas que ya tienen una excepción general no se modifican.",
      confirmText: "Cargar",
      cancelText: "Cancelar",
    });

    if (!ok) return;

    try {
      const result = await loadHolidays.mutateAsync(anio);
      toast.success(
        result.creados.length
          ? `${result.creados.length} feriados cargados${
              result.omitidos.length ? ` (${result.omitidos.length} ya existían)` : ""
            }.`
          : "Los feriados de ese año ya estaban cargados."
      );
    } catch (e) {
      toast.error(errorMessage(e, "No se pudieron cargar los feriados."));
    }
  };

  const eliminar = async (exc: PickupException) => {
    // Quitar una apertura especial puede dejar el día cerrado.
    if (
      exc.tipo === "abierto" &&
      !(await confirmarCierre(
        prompt,
        exc.fecha,
        exc.stock_location_id,
        exc.site_name ?? "el site"
      ))
    ) {
      return;
    }

    const ok = await prompt({
      title: "Eliminar excepción",
      description: `¿Eliminar la excepción del ${fechaCorta(exc.fecha)} (${
        exc.site_name ?? "todos los sites"
      })? El día vuelve a su horario normal.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
    });

    if (!ok) return;

    try {
      await remove.mutateAsync(exc.id);
      toast.success("Excepción eliminada.");
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo eliminar la excepción."));
    }
  };

  const exceptions = data?.exceptions ?? [];

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 p-6 pb-4">
        <div className="flex items-center gap-x-2">
          <Button size="small" variant="secondary" onClick={() => setAnio((a) => a - 1)}>
            ←
          </Button>
          <Text weight="plus" aria-live="polite">
            {anio}
          </Text>
          <Button size="small" variant="secondary" onClick={() => setAnio((a) => a + 1)}>
            →
          </Button>
        </div>
        <div className="flex items-center gap-x-2">
          <Button
            size="small"
            variant="secondary"
            onClick={cargarFeriados}
            disabled={!hayFeriados}
            isLoading={loadHolidays.isPending}
            title={hayFeriados ? undefined : `No hay lista de feriados para ${anio}`}
          >
            Cargar feriados de Chile {anio}
          </Button>
          <ExceptionDrawer
            sites={sites}
            trigger={<Button size="small">Agregar excepción</Button>}
          />
        </div>
      </div>

      {isPending ? (
        <Text size="small" className="px-6 pb-6">
          Cargando...
        </Text>
      ) : error ? (
        <Text size="small" className="px-6 pb-6 text-ui-fg-error">
          No se pudo cargar el calendario: {error.message}
        </Text>
      ) : exceptions.length === 0 ? (
        <Text size="small" className="px-6 pb-6 text-ui-fg-subtle">
          No hay feriados ni excepciones en {anio}.
          {hayFeriados && ` Usa "Cargar feriados de Chile ${anio}".`}
        </Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Fecha</Table.HeaderCell>
              <Table.HeaderCell>Aplica a</Table.HeaderCell>
              <Table.HeaderCell>Tipo</Table.HeaderCell>
              <Table.HeaderCell>Motivo</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {exceptions.map((exc) => (
              <Table.Row key={exc.id}>
                <Table.Cell>{fechaCorta(exc.fecha)}</Table.Cell>
                <Table.Cell>{exc.site_name ?? "Todos los sites"}</Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-x-1">
                    <Badge size="2xsmall" color={TIPOS[exc.tipo].color}>
                      {TIPOS[exc.tipo].label}
                    </Badge>
                    {exc.irrenunciable && (
                      <Badge size="2xsmall" color="grey">
                        Irrenunciable
                      </Badge>
                    )}
                    {exc.capacidad !== null && (
                      <Text size="small" className="text-ui-fg-subtle">
                        {exc.capacidad} cupos
                      </Text>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>{exc.motivo ?? "—"}</Table.Cell>
                <Table.Cell>
                  <div className="flex justify-end gap-x-1">
                    <ExceptionDrawer
                      exception={exc}
                      sites={sites}
                      trigger={
                        <IconButton size="small" variant="transparent" aria-label="Editar excepción">
                          <PencilSquare />
                        </IconButton>
                      }
                    />
                    <IconButton
                      size="small"
                      variant="transparent"
                      aria-label="Eliminar excepción"
                      onClick={() => eliminar(exc)}
                    >
                      <Trash />
                    </IconButton>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Ocupación
// ─────────────────────────────────────────────────────────────────────

const ORIGEN: Record<PickupOccupancyDay["origen"], string> = {
  feriado_irrenunciable: "Feriado irrenunciable",
  excepcion_site: "Excepción del site",
  excepcion_global: "Feriado o excepción general",
  horario_site: "Horario del site",
  por_defecto: "Horario general",
};

const OcupacionTab = ({ sites }: { sites: PickupSiteRow[] }) => {
  const [siteId, setSiteId] = useState<string | undefined>(sites[0]?.id);
  const { data, isPending, error } = usePickupOccupancy(siteId);

  if (!sites.length) {
    return (
      <Text size="small" className="p-6 text-ui-fg-subtle">
        No hay sites de retiro configurados.
      </Text>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-x-3 p-6 pb-4">
        <Label size="small" weight="plus" htmlFor="occ-site">
          Site
        </Label>
        <div className="w-64">
          <Select value={siteId} onValueChange={setSiteId}>
            <Select.Trigger id="occ-site">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {sites.map((s) => (
                <Select.Item key={s.id} value={s.id}>
                  {s.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Hoy y los próximos 13 días.
        </Text>
      </div>

      {isPending ? (
        <Text size="small" className="px-6 pb-6">
          Cargando...
        </Text>
      ) : error ? (
        <Text size="small" className="px-6 pb-6 text-ui-fg-error">
          No se pudo cargar la ocupación: {error.message}
        </Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Fecha</Table.HeaderCell>
              <Table.HeaderCell>Estado</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Capacidad</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Tomados</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Libres</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(data?.dias ?? []).map((d) => (
              <Table.Row key={d.fecha}>
                <Table.Cell>{fechaCorta(d.fecha)}</Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col py-2">
                    <span className="flex items-center gap-x-1">
                      <Badge
                        size="2xsmall"
                        color={
                          !d.abierto
                            ? "grey"
                            : d.capacidad === null
                              ? "red"
                              : d.disponibles === 0
                                ? "orange"
                                : "green"
                        }
                      >
                        {!d.abierto
                          ? "Cerrado"
                          : d.capacidad === null
                            ? "Sin configurar"
                            : d.disponibles === 0
                              ? "Lleno"
                              : "Abierto"}
                      </Badge>
                    </span>
                    <Text size="small" className="text-ui-fg-subtle">
                      {ORIGEN[d.origen]}
                      {d.motivo ? ` · ${d.motivo}` : ""}
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell className="text-right">
                  {d.abierto ? d.capacidad ?? "—" : "—"}
                </Table.Cell>
                <Table.Cell className="text-right">{d.ocupados}</Table.Cell>
                <Table.Cell className="text-right">{d.abierto ? d.disponibles : "—"}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Historial
// ─────────────────────────────────────────────────────────────────────

const ENTIDAD: Record<PickupChange["entidad"], string> = {
  configuracion: "Configuración general",
  site: "Configuración del site",
  horario: "Horario semanal",
  excepcion: "Calendario",
};

const ACCION: Record<PickupChange["accion"], string> = {
  crear: "creó",
  editar: "editó",
  eliminar: "eliminó",
};

const CAMPOS: Record<string, string> = {
  capacidad_por_defecto: "Capacidad por defecto",
  capacidad_diaria: "Capacidad diaria",
  capacidad: "Capacidad",
  lead_time_dias: "Anticipación (días)",
  horizonte_dias: "Horizonte (días)",
  dias_abiertos_por_defecto: "Días abiertos",
  abierto: "Abierto",
  fecha: "Fecha",
  stock_location_id: "Site",
  tipo: "Tipo",
  irrenunciable: "Irrenunciable",
  motivo: "Motivo",
  feriados: "Feriados cargados",
};

const valor = (campo: string, v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (campo === "dias_abiertos_por_defecto" && Array.isArray(v)) {
    return v.map((n) => DIAS.find((d) => d.n === n)?.short ?? n).join(", ");
  }
  if (Array.isArray(v)) return v.join("; ");
  return String(v);
};

const quien = (actor: PickupChange["actor"]) => {
  if (!actor) return "Sistema";
  const nombre = [actor.first_name, actor.last_name].filter(Boolean).join(" ");
  return nombre || actor.email || actor.id;
};

const detalleDe = (c: PickupChange) =>
  [
    c.site_name,
    c.entidad === "horario" && c.referencia ? diaLabel(Number(c.referencia)) : null,
    c.entidad === "excepcion" && c.referencia && /^\d{4}-/.test(c.referencia)
      ? fechaCorta(c.referencia)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

const HistorialTab = () => {
  const { data, isPending } = usePickupChanges();
  const cambios = data?.cambios ?? [];

  return isPending ? (
    <Text size="small" className="p-6">
      Cargando...
    </Text>
  ) : cambios.length === 0 ? (
    <Text size="small" className="p-6 text-ui-fg-subtle">
      Todavía no hay cambios registrados.
    </Text>
  ) : (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Fecha</Table.HeaderCell>
          <Table.HeaderCell>Usuario</Table.HeaderCell>
          <Table.HeaderCell>Qué</Table.HeaderCell>
          <Table.HeaderCell>Cambio</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {cambios.map((c) => (
          <Table.Row key={c.id}>
            <Table.Cell>{fechaHora(c.created_at)}</Table.Cell>
            <Table.Cell>{quien(c.actor)}</Table.Cell>
            <Table.Cell>
              <div className="flex flex-col py-2">
                <span>
                  {ENTIDAD[c.entidad]} ({ACCION[c.accion]})
                </span>
                {detalleDe(c) && (
                  <Text size="small" className="text-ui-fg-subtle">
                    {detalleDe(c)}
                  </Text>
                )}
              </div>
            </Table.Cell>
            <Table.Cell>
              <div className="flex flex-col py-2">
                {Object.entries(c.cambios).map(([campo, v]) => (
                  <span key={campo}>
                    {CAMPOS[campo] ?? campo}:{" "}
                    {c.accion === "crear"
                      ? valor(campo, v.nuevo)
                      : c.accion === "eliminar"
                        ? valor(campo, v.anterior)
                        : `${valor(campo, v.anterior)} → ${valor(campo, v.nuevo)}`}
                  </span>
                ))}
              </div>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Pedidos en días cerrados
// ─────────────────────────────────────────────────────────────────────

const ConflictsAlert = () => {
  const { data } = usePickupConflicts();
  const conflicts = data?.conflicts ?? [];

  if (!conflicts.length) return null;

  return (
    <Container
      className="flex flex-col gap-y-3 border border-ui-tag-orange-border bg-ui-tag-orange-bg p-6"
      data-testid="pickup-conflicts"
    >
      <div className="flex items-start gap-x-2">
        <ExclamationCircle className="mt-0.5 shrink-0 text-ui-tag-orange-icon" />
        <div className="flex flex-col gap-y-1">
          <Heading level="h2">
            {conflicts.length === 1
              ? "1 pedido tiene retiro en un día cerrado"
              : `${conflicts.length} pedidos tienen retiro en un día cerrado`}
          </Heading>
          <Text size="small" className="text-ui-fg-subtle">
            El día se cerró después de que el colaborador eligió la fecha.
            Cerrar un día no anula ni mueve pedidos: avisa al colaborador y,
            si no puede retirar otro día, anula el pedido (se devuelven el
            cupo y el beneficio).
          </Text>
        </div>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Pedido</Table.HeaderCell>
            <Table.HeaderCell>Colaborador</Table.HeaderCell>
            <Table.HeaderCell>Site</Table.HeaderCell>
            <Table.HeaderCell>Fecha</Table.HeaderCell>
            <Table.HeaderCell>Motivo del cierre</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {conflicts.map((c) => (
            <Table.Row key={c.booking_id}>
              <Table.Cell>
                {c.order ? (
                  <a
                    href={`/app/orders/${c.order.id}`}
                    className="text-ui-fg-interactive hover:underline"
                  >
                    #{c.order.display_id}
                  </a>
                ) : (
                  <span className="text-ui-fg-subtle">En proceso</span>
                )}
              </Table.Cell>
              <Table.Cell>{c.order?.email ?? "—"}</Table.Cell>
              <Table.Cell>{c.site_name ?? c.stock_location_id}</Table.Cell>
              <Table.Cell>{fechaCorta(c.fecha)}</Table.Cell>
              <Table.Cell>{c.motivo ?? ORIGEN[c.origen]}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Container>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────

const PickupSchedulingPage = () => {
  const { data, isPending, error } = usePickupSites();
  const sites = useMemo(() => data?.sites ?? [], [data]);

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex flex-col gap-y-2 p-6">
        <Heading className="font-sans font-medium h1-core">Agenda de retiro</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Cuántos pedidos puede entregar cada sala por día, qué días atiende y
          los feriados. Los cambios aplican a las reservas nuevas; los pedidos
          ya hechos mantienen su fecha.
        </Text>
      </Container>

      <ConflictsAlert />

      <Container className="p-0 overflow-hidden">
        {isPending ? (
          <Text size="small" className="p-6">
            Cargando...
          </Text>
        ) : error || !data ? (
          <Text size="small" className="p-6 text-ui-fg-error">
            No se pudo cargar la agenda: {error?.message}
          </Text>
        ) : (
          <Tabs defaultValue="general">
            <div className="px-6 pt-4">
              <Tabs.List>
                <Tabs.Trigger value="general">General</Tabs.Trigger>
                <Tabs.Trigger value="sites">Sites</Tabs.Trigger>
                <Tabs.Trigger value="calendario">Calendario</Tabs.Trigger>
                <Tabs.Trigger value="ocupacion">Ocupación</Tabs.Trigger>
                <Tabs.Trigger value="historial">Historial</Tabs.Trigger>
              </Tabs.List>
            </div>
            <Tabs.Content value="general">
              <GeneralTab settings={data.settings} />
            </Tabs.Content>
            <Tabs.Content value="sites">
              <SitesTab settings={data.settings} sites={sites} />
            </Tabs.Content>
            <Tabs.Content value="calendario">
              <CalendarioTab sites={sites} />
            </Tabs.Content>
            <Tabs.Content value="ocupacion">
              <OcupacionTab sites={sites} />
            </Tabs.Content>
            <Tabs.Content value="historial">
              <HistorialTab />
            </Tabs.Content>
          </Tabs>
        )}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Agenda de retiro",
  icon: Calendar,
});

export default PickupSchedulingPage;
