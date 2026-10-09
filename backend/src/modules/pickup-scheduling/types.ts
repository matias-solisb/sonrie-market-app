export type EstadoBooking = "reservado" | "confirmado" | "liberado";

export type TipoExcepcion = "feriado" | "cerrado" | "abierto";

/** De dónde salió la decisión de abrir o cerrar un día. */
export type OrigenDia =
  | "feriado_irrenunciable"
  | "excepcion_site"
  | "excepcion_global"
  | "horario_site"
  | "por_defecto";

export type ResolvedDay = {
  fecha: string;
  stock_location_id: string;
  abierto: boolean;
  /** Pedidos por día. Null = abierto pero sin capacidad configurada. */
  capacidad: number | null;
  origen: OrigenDia;
  motivo: string | null;
};

export type AvailableDate = ResolvedDay & {
  ocupados: number;
  /** Cupos libres (0 si está cerrado o sin configurar). */
  disponibles: number;
};

export type BookingWindow = {
  /** Primera fecha elegible (hoy + lead-time). */
  desde: string;
  /** Última fecha elegible (hoy + horizonte). */
  hasta: string;
};

export type ReserveBookingInput = {
  cart_id: string;
  stock_location_id: string;
  fecha: string;
  /** Instante que define "hoy" (para lead-time y horizonte). Por defecto, ahora. */
  now?: Date;
};

export type ReserveBookingResult = {
  booking_id: string;
  stock_location_id: string;
  fecha: string;
  /** false si el carrito ya tenía ese mismo cupo (reintento). */
  created: boolean;
};

export type ReleaseBookingInput = {
  order_id: string;
  /** Para encontrar el cupo si aún no tiene `order_id` asignado. */
  cart_id?: string | null;
};

export type ReleaseBookingResult = {
  booking_id: string;
  /** Estado previo, para compensar con `undoRelease`. */
  estado_anterior: EstadoBooking;
  /** false si ya estaba liberado. */
  released: boolean;
};

export type UpdatePickupSettingInput = {
  capacidad_por_defecto?: number | null;
  lead_time_dias?: number;
  horizonte_dias?: number;
  dias_abiertos_por_defecto?: number[];
};

export type UpsertSiteSlotConfigInput = {
  stock_location_id: string;
  capacidad_diaria?: number | null;
  lead_time_dias?: number | null;
  horizonte_dias?: number | null;
};

export type UpsertSiteScheduleInput = {
  stock_location_id: string;
  dia_semana: number;
  abierto: boolean;
  capacidad?: number | null;
};

export type CreateExceptionInput = {
  fecha: string;
  stock_location_id?: string | null;
  tipo: TipoExcepcion;
  irrenunciable?: boolean;
  capacidad?: number | null;
  motivo?: string | null;
};

export type UpdateExceptionInput = {
  fecha?: string;
  stock_location_id?: string | null;
  tipo?: TipoExcepcion;
  irrenunciable?: boolean;
  capacidad?: number | null;
  motivo?: string | null;
};

export type LoadHolidaysResult = {
  anio: number;
  /** Fechas creadas. */
  creados: string[];
  /** Fechas que ya tenían una excepción global (no se tocaron). */
  omitidos: string[];
};
