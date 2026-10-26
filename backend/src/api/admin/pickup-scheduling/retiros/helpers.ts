import type { MedusaRequest } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { EstadoBooking, EstadoRetiro } from "../../../../modules/pickup-scheduling/types";
import { estadoRetiro } from "../../../../modules/pickup-scheduling/utils/estado-retiro";
import { RUT_AUTH_PROVIDER_ID } from "../../../../modules/rut-auth/config";
import { formatRut } from "../../../../utils/rut";

/*

Arma las filas de "Retiros del día" (y del widget del pedido): el cupo +
lo que el operador necesita para entregar sin equivocarse (n.º de pedido,
nombre, RUT, productos).

RUT: sale de la identidad `rut` del colaborador (`provider_identity.
entity_id`, la que usa para entrar), NUNCA de `customer.metadata`: el
colaborador puede editar su propia metadata desde la Store API y así
hacerse pasar por otro en el mostrador (vulnerabilidad #6). Un customer sin
identidad `rut` muestra el correo.

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
  "customer.id",
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

/*
Fragmento SQL: identidades `rut` vigentes con su customer. El vínculo
customer ↔ identidad vive en `auth_identity.app_metadata.customer_id` (sin
module link), igual que en utils/rut-identity.ts.
*/
const RUT_IDENTITY_JOIN = `
  from provider_identity pi
  join auth_identity ai on ai.id = pi.auth_identity_id
 where pi.provider = ?
   and pi.deleted_at is null
   and ai.deleted_at is null`;

/** RUT formateado ("12.345.678-5") por id de customer, desde la identidad `rut`. */
const rutsPorCustomer = async (
  req: MedusaRequest,
  customerIds: string[]
): Promise<Map<string, string>> => {
  const ruts = new Map<string, string>();
  if (!customerIds.length) {
    return ruts;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const { rows } = await pg.raw(
    `select ai.app_metadata->>'customer_id' as customer_id, pi.entity_id
     ${RUT_IDENTITY_JOIN}
       and ai.app_metadata->>'customer_id' in (${customerIds.map(() => "?").join(", ")})`,
    [RUT_AUTH_PROVIDER_ID, ...customerIds]
  );

  for (const r of rows as { customer_id: string; entity_id: string }[]) {
    const rut = formatRut(r.entity_id);
    if (rut) {
      ruts.set(r.customer_id, rut);
    }
  }
  return ruts;
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
  const ruts = await rutsPorCustomer(req, [
    ...new Set(
      [...orders.values()]
        .map((o) => o?.customer?.id)
        .filter(Boolean) as string[]
    ),
  ]);

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
        rut: (order?.customer?.id && ruts.get(order.customer.id)) || null,
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

/** Filas por página de "No retirados" y de la búsqueda. */
export const POR_PAGINA = 10;

export type Paginacion = {
  pagina: number;
  por_pagina: number;
  total: number;
  paginas: number;
};

export const paginacion = (pagina: number, total: number): Paginacion => ({
  pagina,
  por_pagina: POR_PAGINA,
  total,
  paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
});

/** Solo dígitos y K ("12.345.678-K" → "12345678k"). */
const soloRut = (s: string) => s.toLowerCase().replace(/[^0-9k]/g, "");

/** Escapa % y _ para usar el texto dentro de un LIKE. */
const likeSeguro = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/*

Búsqueda de mostrador: devuelve los ids de los pedidos que calzan, sin
cargar cupos ni pedidos completos (eso se hace después, solo para la
página que se muestra).

- N.º de pedido ("1234" o "#1234"): directo por display_id.
- RUT (desde 4 dígitos, con o sin puntos y guion): clientes cuya identidad
  `rut` (`provider_identity.entity_id`), sin guion, empieza con lo escrito.
  No se usa `customer.metadata`: la edita el propio colaborador (#6).
- Nombre o correo (desde 2 caracteres): clientes cuyo nombre completo o
  correo contiene lo escrito.

Un texto solo de dígitos puede ser n.º de pedido o RUT sin puntos: se
buscan ambos. Los clientes se buscan con SQL sobre la tabla `customer`
(PG_CONNECTION) porque el RUT vive en la identidad `rut` (Auth Module, sin
module link al customer) y hay que compararlo sin puntos ni guion.

*/
export const buscarPedidos = async (
  req: MedusaRequest,
  texto: string
): Promise<string[]> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const t = texto.trim().toLowerCase();
  const ids = new Set<string>();

  const numero = t.replace(/^#/, "");
  if (/^\d+$/.test(numero) && numero.length <= 9) {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id"],
      filters: { display_id: Number(numero) } as any,
    });
    data.forEach((o: any) => ids.add(o.id));
  }

  if (t.startsWith("#")) {
    return [...ids];
  }

  const rut = /^[0-9.\-\sk]+$/.test(t) ? soloRut(t) : "";
  const conRut = rut.length >= 4;
  const conTexto = t.length >= 2;

  if (conRut || conTexto) {
    const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
    const patron = `%${likeSeguro(t)}%`;
    const { rows } = await pg.raw(
      `SELECT id FROM customer
        WHERE deleted_at IS NULL
          AND (
            (? AND exists (
              select 1 ${RUT_IDENTITY_JOIN}
                 and ai.app_metadata->>'customer_id' = customer.id
                 and regexp_replace(lower(pi.entity_id), '[^0-9k]', '', 'g') LIKE ?
            ))
            OR (? AND lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) LIKE ?)
            OR (? AND lower(coalesce(email, '')) LIKE ?)
          )
        LIMIT 200`,
      [conRut, RUT_AUTH_PROVIDER_ID, `${likeSeguro(rut)}%`, conTexto, patron, conTexto, patron]
    );
    const clientes = (rows as { id: string }[]).map((r) => r.id);

    if (clientes.length) {
      const { data } = await query.graph({
        entity: "order",
        fields: ["id"],
        filters: { customer_id: clientes } as any,
      });
      data.forEach((o: any) => ids.add(o.id));
    }
  }

  return [...ids];
};
