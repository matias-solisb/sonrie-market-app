import { FetchError } from "@medusajs/js-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sdk } from "../../lib/client";
import { EstadoRetiro } from "../../lib/estado-retiro";
import { queryKeysFactory } from "../../lib/query-key-factory";

/*

Hooks de la página "Agenda de retiro" (rutas /admin/pickup-scheduling/*).
Toda mutación invalida la agenda completa: los cambios de configuración,
horario o excepciones afectan la ocupación y el historial.

*/

export type PickupSettings = {
  id: string;
  capacidad_por_defecto: number | null;
  lead_time_dias: number;
  horizonte_dias: number;
  /** ISO: lunes = 1 … domingo = 7 */
  dias_abiertos_por_defecto: number[];
};

export type PickupSiteConfig = {
  capacidad_diaria: number | null;
  lead_time_dias: number | null;
  horizonte_dias: number | null;
};

export type PickupScheduleDay = {
  dia_semana: number;
  abierto: boolean;
  capacidad: number | null;
};

export type PickupSiteRow = {
  id: string;
  name: string;
  address: { address_1?: string | null; city?: string | null } | null;
  config: PickupSiteConfig | null;
  horario: PickupScheduleDay[];
};

export type PickupExceptionTipo = "feriado" | "cerrado" | "abierto";

export type PickupException = {
  id: string;
  fecha: string;
  stock_location_id: string | null;
  site_name: string | null;
  tipo: PickupExceptionTipo;
  irrenunciable: boolean;
  capacidad: number | null;
  motivo: string | null;
};

export type PickupExceptionInput = {
  fecha?: string;
  stock_location_id?: string | null;
  tipo?: PickupExceptionTipo;
  irrenunciable?: boolean;
  capacidad?: number | null;
  motivo?: string | null;
};

export type PickupOccupancyDay = {
  fecha: string;
  abierto: boolean;
  capacidad: number | null;
  ocupados: number;
  disponibles: number;
  origen:
    | "feriado_irrenunciable"
    | "excepcion_site"
    | "excepcion_global"
    | "horario_site"
    | "por_defecto";
  motivo: string | null;
};

export type PickupChange = {
  id: string;
  created_at: string;
  entidad: "configuracion" | "site" | "horario" | "excepcion";
  accion: "crear" | "editar" | "eliminar";
  stock_location_id: string | null;
  site_name: string | null;
  referencia: string | null;
  cambios: Record<string, { anterior: unknown; nuevo: unknown }>;
  actor: {
    id: string;
    email: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

/** Estado guardado del cupo (ver models/pickup-booking.ts del módulo). */
export type PickupBookingEstado = "pendiente" | "agendado" | "retirado" | "anulado";

export type PickupOrderRef = {
  id: string;
  display_id: number;
  email: string | null;
  status: string;
} | null;

export type PickupBooking = {
  id: string;
  order_id: string | null;
  cart_id: string;
  stock_location_id: string;
  site_name: string | null;
  fecha: string;
  estado: PickupBookingEstado;
  order: PickupOrderRef;
};

export type PickupConflict = {
  booking_id: string;
  order_id: string | null;
  cart_id: string;
  stock_location_id: string;
  site_name: string | null;
  fecha: string;
  estado: PickupBookingEstado;
  origen: PickupOccupancyDay["origen"];
  motivo: string | null;
  order: PickupOrderRef;
};

export const pickupSchedulingQueryKey = queryKeysFactory("pickup_scheduling");

const BASE = "/admin/pickup-scheduling";
const json = { "Content-Type": "application/json" };

export const usePickupSites = () =>
  useQuery({
    queryKey: pickupSchedulingQueryKey.list({ sites: true }),
    queryFn: () =>
      sdk.client.fetch<{ settings: PickupSettings; sites: PickupSiteRow[] }>(
        `${BASE}/sites`,
        { method: "GET" }
      ),
  });

export const usePickupExceptions = (desde: string, hasta: string) =>
  useQuery({
    queryKey: pickupSchedulingQueryKey.list({ exceptions: true, desde, hasta }),
    queryFn: () =>
      sdk.client.fetch<{ exceptions: PickupException[] }>(
        `${BASE}/exceptions?desde=${desde}&hasta=${hasta}`,
        { method: "GET" }
      ),
  });

export const usePickupHolidayYears = () =>
  useQuery({
    queryKey: pickupSchedulingQueryKey.list({ feriados: true }),
    queryFn: () =>
      sdk.client.fetch<{ anios: number[] }>(`${BASE}/feriados`, {
        method: "GET",
      }),
  });

export const usePickupOccupancy = (stockLocationId?: string) =>
  useQuery({
    queryKey: pickupSchedulingQueryKey.list({ occupancy: stockLocationId }),
    queryFn: () =>
      sdk.client.fetch<{ dias: PickupOccupancyDay[] }>(
        `${BASE}/occupancy?stock_location_id=${stockLocationId}`,
        { method: "GET" }
      ),
    enabled: Boolean(stockLocationId),
  });

export const usePickupChanges = () =>
  useQuery({
    queryKey: pickupSchedulingQueryKey.list({ cambios: true }),
    queryFn: () =>
      sdk.client.fetch<{ cambios: PickupChange[] }>(`${BASE}/changes`, {
        method: "GET",
      }),
  });

// ---------------------------------------------------------------------
// Retiros (entrega en sala de venta)
// ---------------------------------------------------------------------

export type Retiro = {
  booking_id: string;
  order_id: string | null;
  display_id: number | null;
  stock_location_id: string;
  site_name: string | null;
  fecha: string;
  estado: PickupBookingEstado;
  estado_retiro: EstadoRetiro;
  colaborador: { nombre: string | null; rut: string | null; email: string | null };
  productos: { titulo: string; variante: string | null; cantidad: number }[];
  total_unidades: number;
  retirado_at: string | null;
  retirado_por_email: string | null;
  retirado_fuera_de_pantalla: boolean;
};

export type RetirosResponse = {
  hoy: string;
  fecha: string;
  busqueda: string | null;
  retiros: Retiro[];
  no_retirados: Retiro[];
  /** Página de "No retirados" (o de la búsqueda). Null en el widget del pedido. */
  paginacion: { pagina: number; por_pagina: number; total: number; paginas: number } | null;
  resumen: {
    por_entregar: number;
    entregados: number;
    no_retirados: number;
    anulados: number;
  } | null;
};

export const retirosQueryKey = queryKeysFactory("pickup_retiros");

/**
 * Retiros de un día y site (o búsqueda por RUT, nombre o n.º de pedido).
 * Se refresca solo cada minuto, por si otra persona entrega en otro
 * computador del mismo site.
 */
export const useRetiros = (params: {
  stock_location_id?: string;
  fecha?: string;
  q?: string;
  /** Página de "No retirados" o de la búsqueda (10 por página). */
  pagina?: number;
}) => {
  const search = new URLSearchParams();
  if (params.stock_location_id) search.set("stock_location_id", params.stock_location_id);
  if (params.fecha) search.set("fecha", params.fecha);
  if (params.q) search.set("q", params.q);
  if (params.pagina && params.pagina > 1) search.set("pagina", String(params.pagina));

  return useQuery({
    queryKey: retirosQueryKey.list(params),
    queryFn: () =>
      sdk.client.fetch<RetirosResponse>(`${BASE}/retiros?${search.toString()}`, {
        method: "GET",
      }),
    refetchInterval: 60_000,
    placeholderData: (previous) => previous,
  });
};

/**
 * Retiro de un pedido (widget del detalle). `orderStatus` va en la clave:
 * cuando Medusa cambia el pedido (p. ej. "Cancel"), el widget vuelve a
 * leer el retiro. Mientras el pedido figura anulado pero el cupo todavía no
 * (lo libera un subscriber, después), consulta cada 2 s hasta verlo anulado.
 */
export const usePickupOrderRetiro = (orderId: string, orderStatus?: string) =>
  useQuery({
    queryKey: [...retirosQueryKey.detail(orderId), orderStatus ?? null],
    queryFn: () =>
      sdk.client.fetch<RetirosResponse>(`${BASE}/retiros?order_id=${orderId}`, {
        method: "GET",
      }),
    refetchInterval: (query) => {
      const estado = query.state.data?.retiros[0]?.estado;
      return orderStatus === "canceled" && (estado === "pendiente" || estado === "agendado")
        ? 2000
        : false;
    },
  });

/**
 * Entrega un pedido (cupo retirado + cumplimiento entregado). Refresca los
 * retiros, la agenda y el detalle del pedido de Medusa.
 */
export const useEntregarPedido = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { retiro: Retiro; entregado_ahora: boolean },
    FetchError,
    string
  >({
    mutationFn: (orderId: string) =>
      sdk.client.fetch(`${BASE}/retiros/${orderId}/entregar`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: retirosQueryKey.all });
      queryClient.invalidateQueries({ queryKey: pickupSchedulingQueryKey.all });
      // Detalle del pedido del Admin de Medusa (sección de cumplimientos).
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

/** Pedidos agendados en días que hoy están cerrados. */
export const usePickupConflicts = () =>
  useQuery({
    queryKey: pickupSchedulingQueryKey.list({ conflicts: true }),
    queryFn: () =>
      sdk.client.fetch<{ conflicts: PickupConflict[] }>(`${BASE}/conflicts`, {
        method: "GET",
      }),
  });

/**
 * Pedidos agendados una fecha (de un site o de todos). Se llama antes de
 * cerrar un día, para avisar cuántos pedidos quedan afectados.
 */
export const fetchPickupBookingsOn = (
  fecha: string,
  stockLocationId: string | null
) =>
  sdk.client.fetch<{ bookings: PickupBooking[] }>(
    `${BASE}/bookings?fecha=${fecha}${
      stockLocationId ? `&stock_location_id=${stockLocationId}` : ""
    }`,
    { method: "GET" }
  );

/** Mutación genérica: llama a la ruta e invalida toda la agenda. */
const usePickupMutation = <TBody, TResult>(
  request: (body: TBody) => Promise<TResult>
) => {
  const queryClient = useQueryClient();

  return useMutation<TResult, FetchError, TBody>({
    mutationFn: request,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pickupSchedulingQueryKey.all });
    },
  });
};

export const useUpdatePickupSettings = () =>
  usePickupMutation((body: Partial<Omit<PickupSettings, "id">>) =>
    sdk.client.fetch<{ settings: PickupSettings }>(`${BASE}/settings`, {
      method: "POST",
      headers: json,
      body,
    })
  );

export const useUpdatePickupSite = (stockLocationId: string) =>
  usePickupMutation((body: Partial<PickupSiteConfig>) =>
    sdk.client.fetch<{ config: PickupSiteConfig }>(
      `${BASE}/sites/${stockLocationId}`,
      { method: "POST", headers: json, body }
    )
  );

/** Guarda (abierto/capacidad) o quita (null) el horario propio de un día. */
export const useSetPickupScheduleDay = (stockLocationId: string) =>
  usePickupMutation(
    ({
      dia_semana,
      value,
    }: {
      dia_semana: number;
      value: { abierto: boolean; capacidad: number | null } | null;
    }) =>
      sdk.client.fetch(`${BASE}/sites/${stockLocationId}/horario/${dia_semana}`, {
        method: value ? "POST" : "DELETE",
        ...(value && { headers: json, body: value }),
      })
  );

/**
 * Guarda el panel de un site (configuración + horario semanal) en una sola
 * llamada y una sola transacción: si algo falla, no queda nada a medias.
 */
export type PickupSiteAgendaInput = {
  config?: Partial<PickupSiteConfig>;
  horario?: {
    dia_semana: number;
    value: { abierto: boolean; capacidad: number | null } | null;
  }[];
};

export const useSavePickupSiteAgenda = (stockLocationId: string) =>
  usePickupMutation((body: PickupSiteAgendaInput) =>
    sdk.client.fetch<{ config: PickupSiteConfig | null; horario: PickupScheduleDay[] }>(
      `${BASE}/sites/${stockLocationId}/agenda`,
      { method: "POST", headers: json, body }
    )
  );

export const useCreatePickupException = () =>
  usePickupMutation((body: PickupExceptionInput) =>
    sdk.client.fetch<{ exception: PickupException }>(`${BASE}/exceptions`, {
      method: "POST",
      headers: json,
      body,
    })
  );

export const useUpdatePickupException = () =>
  usePickupMutation(({ id, ...body }: PickupExceptionInput & { id: string }) =>
    sdk.client.fetch<{ exception: PickupException }>(
      `${BASE}/exceptions/${id}`,
      { method: "POST", headers: json, body }
    )
  );

export const useDeletePickupException = () =>
  usePickupMutation((id: string) =>
    sdk.client.fetch(`${BASE}/exceptions/${id}`, { method: "DELETE" })
  );

export const useLoadPickupHolidays = () =>
  usePickupMutation((anio: number) =>
    sdk.client.fetch<{ anio: number; creados: string[]; omitidos: string[] }>(
      `${BASE}/feriados`,
      { method: "POST", headers: json, body: { anio } }
    )
  );
