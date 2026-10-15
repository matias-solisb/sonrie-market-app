/**
 * Estado guardado del cupo de retiro (ver models/pickup-booking.ts).
 * `pendiente` → `agendado` → `retirado`, o `anulado`.
 */
export type EstadoBooking = "pendiente" | "agendado" | "retirado" | "anulado";
// F1: agregar "preparado" (el operador armó el pedido y está listo para
// retiro) entre "agendado" y "retirado". Ver models/pickup-booking.ts.

/**
 * Estado del retiro tal como lo ve una persona. No se guarda: se calcula
 * con el estado guardado y la fecha de hoy (ver utils/estado-retiro.ts).
 * - `retira_hoy`: agendado para hoy.
 * - `no_retirado`: agendado para un día que ya pasó y nadie lo entregó.
 */
export type EstadoRetiro =
  | "pendiente"
  | "agendado"
  | "retira_hoy"
  | "no_retirado"
  | "retirado"
  | "anulado";
// F1: | "preparado"

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

/** Pedido agendado en un día que hoy está cerrado (ver listBookingConflicts). */
export type BookingConflict = {
  booking_id: string;
  cart_id: string;
  order_id: string | null;
  stock_location_id: string;
  fecha: string;
  estado: EstadoBooking;
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
  /** false si ya estaba anulado (o retirado: un pedido entregado no se anula). */
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

/**
 * Panel "Agenda de {site}" del Admin, guardado de una vez: configuración
 * propia y horario semanal. `horario[].value = null` quita el horario propio
 * de ese día (vuelve al general). Lo que no viene no se toca.
 */
export type SaveSiteAgendaInput = {
  stock_location_id: string;
  config?: Omit<UpsertSiteSlotConfigInput, "stock_location_id">;
  horario?: {
    dia_semana: number;
    value: { abierto: boolean; capacidad?: number | null } | null;
  }[];
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

/** Usuario del Admin que entregó el pedido (null: sistema o desconocido). */
export type RetiroActor = { id: string; email?: string | null } | null;

export type MarkRetiradoInput = {
  order_id: string;
  actor?: RetiroActor;
  /** Instante de la entrega. Por defecto, ahora. */
  now?: Date;
};

export type MarkRetiradoResult = {
  booking_id: string;
  /** false si ya estaba retirado (reintento o doble clic). */
  retirado: boolean;
  /**
   * true si quedó registrado quién entregó: al retirarlo, o después, si
   * se había marcado sin usuario (entrega con los botones nativos).
   */
  actor_registrado?: boolean;
};
