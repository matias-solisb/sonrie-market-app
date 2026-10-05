export type ReserveConsumptionInput = {
  customer_id: string;
  cart_id: string;
  /** Total del carrito en CLP enteros (con IVA). */
  monto: number;
  /** Fecha que define el periodo. Por defecto, ahora. */
  fecha?: Date;
};

export type ReserveConsumptionResult = {
  movement_id: string;
  budget_id: string;
  periodo: string;
  /** false si el carrito ya tenía su consumo registrado (reintento). */
  created: boolean;
};

export type RefundOrderInput = {
  order_id: string;
  /** Para encontrar el consumo si aún no tiene `order_id` asignado. */
  cart_id?: string | null;
};

export type RefundOrderResult = {
  movement_id: string;
  budget_id: string;
  periodo: string;
  monto: number;
  /** false si el pedido ya estaba reintegrado. */
  created: boolean;
};

export type SetTopeOverrideInput = {
  customer_id: string;
  periodo: string;
  /** null quita la excepción y vuelve al tope de la campaña. */
  tope_override: number | null;
};

export type BenefitBalance = {
  campaign_id: string;
  /** null si el colaborador aún no tiene fila en el periodo. */
  budget_id: string | null;
  periodo: string;
  /** Tope efectivo: override si existe, si no el de la campaña. */
  tope: number;
  tope_override: number | null;
  consumido: number;
  disponible: number;
};
