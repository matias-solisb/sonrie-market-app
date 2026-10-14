import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  CheckCircleSolid,
  ExclamationCircleSolid,
  MagnifyingGlass,
  ShoppingBag,
  TriangleLeftMini,
  TriangleRightMini,
  XCircle,
} from "@medusajs/icons";
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Text,
} from "@medusajs/ui";
import { ComponentType, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EntregarPrompt } from "../../components/retiros/entregar-prompt";
import {
  Retiro,
  usePickupSites,
  useRetiros,
} from "../../hooks/api/pickup-scheduling";
import {
  EstadoRetiroChip,
  fechaHora,
  fechaLarga,
  sePuedeEntregar,
} from "../../lib/estado-retiro";

/*

"Retiros del día": la pantalla del operador de la sala de venta.

Pensada para personas de cualquier edad y poca práctica con sistemas:
- Una pregunta por pantalla: ¿qué pedidos hay que entregar hoy en mi site?
- Cuatro contadores grandes que también sirven de filtro:
  Por entregar · Entregados · No retirados · Anulados.
- Buscador de mostrador: el colaborador dice su RUT (o nombre, o n.º de
  pedido) y aparece su pedido, sea del día que sea.
- Un botón "Entregar" por pedido, con confirmación que muestra nombre, RUT
  y productos (components/retiros/entregar-prompt.tsx).
- Texto de 16 px o más, botones grandes con texto (nunca solo ícono),
  estados con ícono + texto (nunca solo color), fechas en palabras.
- Mensajes que dicen qué pasó y qué sigue, también cuando no hay nada.

El site elegido se recuerda en este computador (localStorage, si está
disponible). Se refresca sola cada minuto.

F1 — "Listo para retiro": agregar un contador/pestaña "Por preparar" y un
botón "Preparar" antes de "Entregar" (ver workflow entregar-pedido).
RBAC (F2): cuando un operador tenga un único site, fijar el selector.

*/

type Pestana = "por_entregar" | "entregados" | "no_retirados" | "anulados";

const SITE_KEY = "sonrie.retiros.site";

const leerSite = () => {
  try {
    return window.localStorage.getItem(SITE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

const guardarSite = (id: string) => {
  try {
    window.localStorage.setItem(SITE_KEY, id);
  } catch {
    // sin almacenamiento: solo no se recuerda
  }
};

/** "2026-10-14" + n días (fecha de calendario). */
const sumarDias = (fecha: string, n: number) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Espera a que la persona deje de escribir antes de buscar. */
const useDebounced = (value: string, ms = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
};

const PESTANAS: {
  id: Pestana;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  activo: string;
}[] = [
  { id: "por_entregar", label: "Por entregar", Icon: ShoppingBag, activo: "border-ui-tag-orange-border bg-ui-tag-orange-bg" },
  { id: "entregados", label: "Entregados", Icon: CheckCircleSolid, activo: "border-ui-tag-green-border bg-ui-tag-green-bg" },
  { id: "no_retirados", label: "No retirados", Icon: ExclamationCircleSolid, activo: "border-ui-tag-red-border bg-ui-tag-red-bg" },
  { id: "anulados", label: "Anulados", Icon: XCircle, activo: "border-ui-tag-neutral-border bg-ui-tag-neutral-bg" },
];

const VACIO: Record<Pestana, string> = {
  por_entregar: "No quedan pedidos por entregar este día.",
  entregados: "Todavía no se ha entregado ningún pedido este día.",
  no_retirados: "No hay pedidos atrasados. ¡Todo al día!",
  anulados: "No hay pedidos anulados este día.",
};

const RetirosPage = () => {
  const { data: sitesData } = usePickupSites();
  const sites = sitesData?.sites ?? [];

  const [siteId, setSiteId] = useState<string | undefined>(leerSite);
  const [fecha, setFecha] = useState<string | undefined>(undefined);
  const [pestana, setPestana] = useState<Pestana>("por_entregar");
  const [busqueda, setBusqueda] = useState("");
  const [confirmando, setConfirmando] = useState<Retiro | null>(null);
  const q = useDebounced(busqueda.trim());

  // Si el site recordado ya no existe, usar el primero.
  useEffect(() => {
    if (sites.length && (!siteId || !sites.some((s) => s.id === siteId))) {
      setSiteId(sites[0].id);
    }
  }, [sites, siteId]);

  const { data, isPending, isError, refetch, isFetching } = useRetiros({
    stock_location_id: siteId,
    fecha,
    q: q || undefined,
  });

  const hoy = data?.hoy;
  const dia = fecha ?? hoy;
  const siteName = sites.find((s) => s.id === siteId)?.name;

  const filas = useMemo(() => {
    if (!data) return [];
    if (data.busqueda) return data.retiros;
    if (pestana === "no_retirados") return data.no_retirados;
    const estados: Record<Exclude<Pestana, "no_retirados">, string[]> = {
      por_entregar: ["agendado", "retira_hoy"],
      entregados: ["retirado"],
      anulados: ["anulado"],
    };
    return data.retiros.filter((r) => estados[pestana].includes(r.estado_retiro));
  }, [data, pestana]);

  const cambiarSite = (id: string) => {
    setSiteId(id);
    guardarSite(id);
  };

  const tituloDia = dia
    ? `${dia === hoy ? "Hoy, " : ""}${dia === hoy ? fechaLarga(dia) : capitalizar(fechaLarga(dia))}`
    : "";

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex flex-col gap-y-5 px-6 py-5">
        <div>
          <Heading level="h1" className="text-2xl">Retiros del día</Heading>
          <Text size="base" className="text-ui-fg-subtle">
            Entrega los pedidos que los colaboradores vienen a buscar a la sala de venta.
          </Text>
        </div>

        {/* Site y día */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-[240px] flex-col gap-y-1">
            <Label htmlFor="retiros-site" className="text-base">Site</Label>
            <Select value={siteId} onValueChange={cambiarSite}>
              <Select.Trigger id="retiros-site" className="h-11 text-base">
                <Select.Value placeholder="Elige el site" />
              </Select.Trigger>
              <Select.Content>
                {sites.map((s) => (
                  <Select.Item key={s.id} value={s.id} className="text-base">
                    {s.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {dia && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="large"
                onClick={() => setFecha(sumarDias(dia, -1))}
                aria-label="Ver el día anterior"
              >
                <TriangleLeftMini /> Día anterior
              </Button>
              <span className="min-w-[260px] text-center text-lg font-semibold" data-testid="retiros-dia">
                {tituloDia}
              </span>
              <Button
                variant="secondary"
                size="large"
                onClick={() => setFecha(sumarDias(dia, 1))}
                aria-label="Ver el día siguiente"
              >
                Día siguiente <TriangleRightMini />
              </Button>
              {dia !== hoy && (
                <Button variant="transparent" size="large" onClick={() => setFecha(undefined)}>
                  Volver a hoy
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Buscador de mostrador */}
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="retiros-buscar" className="text-base">
            Buscar un pedido
          </Label>
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ui-fg-muted" />
            <Input
              id="retiros-buscar"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="RUT, nombre o N° de pedido"
              className="h-12 pl-9 text-lg"
              autoComplete="off"
              data-testid="retiros-buscar"
            />
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            Busca en todos los días, por si el colaborador viene otro día.
          </Text>
        </div>

        {/* Contadores = pestañas */}
        {!q && data?.resumen && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" role="tablist">
            {PESTANAS.map(({ id, label, Icon, activo }) => {
              const n = data.resumen![id];
              const seleccionada = pestana === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={seleccionada}
                  onClick={() => setPestana(id)}
                  className={`flex flex-col items-start gap-y-1 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                    seleccionada ? activo : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-hover"
                  }`}
                  data-testid={`retiros-pestana-${id}`}
                >
                  <span className="text-3xl font-bold leading-none">{n}</span>
                  <span className="flex items-center gap-x-1.5 text-base font-medium">
                    <Icon /> {label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Container>

      {/* Lista */}
      <Container className="p-0">
        <div className="flex items-center justify-between gap-x-2 border-b px-6 py-4">
          <Heading level="h2" className="text-lg">
            {q
              ? `Resultados para «${q}»`
              : `${PESTANAS.find((p) => p.id === pestana)!.label}${
                  pestana === "no_retirados" ? " (días anteriores)" : ""
                }${siteName ? ` · ${siteName}` : ""}`}
          </Heading>
          {q ? (
            <Button variant="secondary" size="large" onClick={() => setBusqueda("")}>
              Limpiar búsqueda
            </Button>
          ) : (
            <Button
              variant="transparent"
              size="large"
              onClick={() => refetch()}
              isLoading={isFetching && !isPending}
            >
              Actualizar
            </Button>
          )}
        </div>

        {isPending ? (
          <Text size="base" className="px-6 py-8">Cargando pedidos...</Text>
        ) : isError ? (
          <Text size="base" className="px-6 py-8 text-ui-fg-error">
            No se pudieron cargar los pedidos. Revisa tu conexión y presiona "Actualizar".
          </Text>
        ) : !filas.length ? (
          <Text size="base" className="px-6 py-8 text-ui-fg-subtle" data-testid="retiros-vacio">
            {q
              ? "No encontramos pedidos con ese RUT, nombre o número en este site. Revisa que esté bien escrito."
              : VACIO[pestana]}
          </Text>
        ) : (
          <ul className="divide-y" data-testid="retiros-lista">
            {filas.map((r) => (
              <FilaRetiro
                key={r.booking_id}
                retiro={r}
                hoy={hoy!}
                mostrarFecha={!!q || pestana === "no_retirados" || r.fecha !== dia}
                onEntregar={() => setConfirmando(r)}
              />
            ))}
          </ul>
        )}
      </Container>

      {hoy && (
        <EntregarPrompt retiro={confirmando} hoy={hoy} onClose={() => setConfirmando(null)} />
      )}
    </div>
  );
};

const FilaRetiro = ({
  retiro: r,
  hoy,
  mostrarFecha,
  onEntregar,
}: {
  retiro: Retiro;
  hoy: string;
  mostrarFecha: boolean;
  onEntregar: () => void;
}) => {
  const resumenProductos = r.productos
    .map((p) => `${p.cantidad} × ${p.titulo}`)
    .join(", ");

  return (
    <li
      className="grid grid-cols-1 items-center gap-3 px-6 py-4 md:grid-cols-[110px_1fr_auto]"
      data-testid="retiros-fila"
    >
      <div className="flex flex-col">
        <span className="text-2xl font-bold">{r.display_id ? `#${r.display_id}` : "—"}</span>
        {r.order_id && (
          <Link to={`/orders/${r.order_id}`} className="text-sm text-ui-fg-interactive hover:underline">
            Ver pedido
          </Link>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-y-1">
        <span className="text-lg font-semibold">
          {r.colaborador.nombre ?? r.colaborador.email ?? "Sin nombre"}
        </span>
        <span className="text-base text-ui-fg-subtle">
          {r.colaborador.rut ? `RUT ${r.colaborador.rut}` : r.colaborador.email ?? ""}
        </span>
        <span className="truncate text-base" title={resumenProductos}>
          {r.total_unidades} {r.total_unidades === 1 ? "unidad" : "unidades"}: {resumenProductos}
        </span>
        {mostrarFecha && (
          <span className="text-base">
            {r.fecha === hoy ? "Agendado para hoy" : `Agendado para el ${fechaLarga(r.fecha)}`}
            {r.site_name ? ` · ${r.site_name}` : ""}
          </span>
        )}
        {r.estado === "retirado" && r.retirado_at && (
          <span className="text-base text-ui-fg-subtle">
            Entregado el {fechaHora(r.retirado_at)}
            {r.retirado_por_email
              ? ` por ${r.retirado_por_email}`
              : r.retirado_fuera_de_pantalla
              ? " (desde el detalle del pedido)"
              : ""}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 md:justify-end">
        <EstadoRetiroChip estado={r.estado_retiro} />
        {sePuedeEntregar(r.estado_retiro) && (
          <Button
            size="large"
            className="min-w-[140px] text-base"
            onClick={onEntregar}
            data-testid="retiros-entregar"
          >
            Entregar
          </Button>
        )}
      </div>
    </li>
  );
};

export const config = defineRouteConfig({
  label: "Retiros del día",
  icon: ShoppingBag,
  rank: 0,
});

export default RetirosPage;
