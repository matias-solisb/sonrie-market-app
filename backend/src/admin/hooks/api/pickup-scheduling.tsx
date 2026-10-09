import { FetchError } from "@medusajs/js-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sdk } from "../../lib/client";
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

export type PickupBookingEstado = "reservado" | "confirmado" | "liberado";

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

/** Cupo de retiro de un pedido (widget del detalle del pedido). */
export const usePickupOrderBooking = (orderId: string) =>
  useQuery({
    queryKey: pickupSchedulingQueryKey.list({ booking_order: orderId }),
    queryFn: () =>
      sdk.client.fetch<{ bookings: PickupBooking[] }>(
        `${BASE}/bookings?order_id=${orderId}`,
        { method: "GET" }
      ),
  });

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
