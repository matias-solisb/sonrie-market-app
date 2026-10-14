import type { MedusaRequest } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { EstadoBooking, EstadoRetiro } from "../../../../modules/pickup-scheduling/types";
import { estadoRetiro } from "../../../../modules/pickup-scheduling/utils/estado-retiro";

/*

Arma las filas de "Retiros del día" (y del widget del pedido): el cupo +
lo que el operador necesita para entregar sin equivocarse (n.º de pedido,
nombre, RUT, productos).

RUT: hoy no existe un campo propio (llega con rut-auth / employee-sync). Se
lee de `customer.metadata.rut` si está; si no, la pantalla muestra el
correo. Cuando exista el campo definitivo, cambiar solo `rutDe`.

*/

type BookingRow = {
  id: string;
  order_id: string | null;
  stock_location_id: string;
  fecha: string;
  estado: EstadoBooking;
  retirado_at?: Date | string | null;
  retirado_por?: string | null;
  retirado_por_email?: string | null;
};

export type RetiroProducto = {
  titulo: string;
  variante: string | null;
  cantidad: number;
};

export type Retiro = {
  booking_id: string;
  order_id: string | null;
  display_id: number | null;
  stock_location_id: string;
  site_name: string | null;
  fecha: string;
  /** Estado guardado del cupo. */
  estado: EstadoBooking;
  /** Estado para mostrar (calcula "retira hoy" y "no retirado"). */
  estado_retiro: EstadoRetiro;
  colaborador: { nombre: string | null; rut: string | null; email: string | null };
  productos: RetiroProducto[];
  total_unidades: number;
  retirado_at: string | null;
  retirado_por_email: string | null;
  /** true si se entregó con los botones nativos del Admin (sin usuario registrado). */
  retirado_fuera_de_pantalla: boolean;
};

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "status",
  "customer.first_name",
  "customer.last_name",
  "customer.email",
  "customer.metadata",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "items.id",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.detail.quantity", // la cantidad vive en el detalle (OrderItem), no en la línea
];

/** Cantidad de una línea del pedido (viene del detalle: OrderItem). */
export const cantidadDe = (item: any): number => {
  const n = Number(item?.quantity ?? item?.detail?.quantity);
  return Number.isFinite(n) ? n : 0;
};

const rutDe = (order: any): string | null => {
  const rut = order?.customer?.metadata?.rut;
  return typeof rut === "string" && rut.trim() ? rut.trim() : null;
};

const nombreDe = (order: any): string | null => {
  const desde = (o: any) =>
    [o?.first_name, o?.last_name].filter(Boolean).join(" ").trim();

  return desde(order?.customer) || desde(order?.shipping_address) || null;
};

/** Pedidos por id con los campos que muestran las pantallas de retiro. */
const ordersById = async (req: MedusaRequest, ids: string[]) => {
  if (!ids.length) {
    return new Map<string, any>();
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: ids },
  });

  return new Map<string, any>(data.map((o: any) => [o.id, o]));
};

export const toRetiros = async (
  req: MedusaRequest,
  bookings: BookingRow[],
  names: Map<string, string>,
  hoy: string
): Promise<Retiro[]> => {
  const orders = await ordersById(
    req,
    bookings.map((b) => b.order_id).filter(Boolean) as string[]
  );

  return bookings.map((b) => {
    const order = b.order_id ? orders.get(b.order_id) : null;
    const productos: RetiroProducto[] = (order?.items ?? []).map((i: any) => ({
      titulo: i.product_title ?? i.title ?? "Producto",
      variante:
        i.variant_title && i.variant_title !== "Default variant"
          ? i.variant_title
          : null,
      cantidad: cantidadDe(i),
    }));

    const retiradoAt = b.retirado_at
      ? new Date(b.retirado_at as any).toISOString()
      : null;

    return {
      booking_id: b.id,
      order_id: b.order_id,
      display_id: order?.display_id ?? null,
      stock_location_id: b.stock_location_id,
      site_name: names.get(b.stock_location_id) ?? null,
      fecha: b.fecha,
      estado: b.estado,
      estado_retiro: estadoRetiro(b, hoy),
      colaborador: {
        nombre: nombreDe(order),
        rut: rutDe(order),
        email: order?.customer?.email ?? order?.email ?? null,
      },
      productos,
      total_unidades: productos.reduce((n, p) => n + p.cantidad, 0),
      retirado_at: retiradoAt,
      retirado_por_email: b.retirado_por_email ?? null,
      retirado_fuera_de_pantalla:
        b.estado === "retirado" && !b.retirado_por,
    };
  });
};

/** Quita puntos, guiones y espacios, y pasa a minúsculas ("12.345.678-K" → "12345678k"). */
const normalizar = (s: string) => s.toLowerCase().replace(/[.\-\s]/g, "");

/** ¿La fila calza con lo que escribió el operador (RUT, nombre, correo o n.º)? */
export const calzaBusqueda = (r: Retiro, q: string): boolean => {
  const texto = q.trim().toLowerCase();
  if (!texto) {
    return true;
  }

  const numero = texto.replace(/^#/, "");
  if (/^\d+$/.test(numero) && String(r.display_id ?? "") === numero) {
    return true;
  }

  const rutBuscado = normalizar(texto);
  if (r.colaborador.rut && rutBuscado.length >= 4 &&
      normalizar(r.colaborador.rut).startsWith(rutBuscado)) {
    return true;
  }

  return [r.colaborador.nombre, r.colaborador.email]
    .filter(Boolean)
    .some((v) => (v as string).toLowerCase().includes(texto));
};
