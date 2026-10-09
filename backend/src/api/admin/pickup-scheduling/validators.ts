import { z } from "zod";

const Fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD.");
const Cantidad = z.number().int().min(0);
const DiaSemana = z.number().int().min(1).max(7);

export type AdminUpdatePickupSettingsType = z.infer<typeof AdminUpdatePickupSettings>;
export const AdminUpdatePickupSettings = z
  .object({
    capacidad_por_defecto: Cantidad.nullable().optional(),
    lead_time_dias: Cantidad.optional(),
    horizonte_dias: Cantidad.optional(),
    dias_abiertos_por_defecto: z.array(DiaSemana).optional(),
  })
  .strict();

export type AdminUpdatePickupSiteType = z.infer<typeof AdminUpdatePickupSite>;
export const AdminUpdatePickupSite = z
  .object({
    capacidad_diaria: Cantidad.nullable().optional(),
    lead_time_dias: Cantidad.nullable().optional(),
    horizonte_dias: Cantidad.nullable().optional(),
  })
  .strict();

export type AdminUpsertPickupScheduleType = z.infer<typeof AdminUpsertPickupSchedule>;
export const AdminUpsertPickupSchedule = z
  .object({
    abierto: z.boolean(),
    capacidad: Cantidad.nullable().optional(),
  })
  .strict();

const TipoExcepcion = z.enum(["feriado", "cerrado", "abierto"]);

export type AdminCreatePickupExceptionType = z.infer<typeof AdminCreatePickupException>;
export const AdminCreatePickupException = z
  .object({
    fecha: Fecha,
    stock_location_id: z.string().min(1).nullable().optional(),
    tipo: TipoExcepcion,
    irrenunciable: z.boolean().optional(),
    capacidad: Cantidad.nullable().optional(),
    motivo: z.string().max(200).nullable().optional(),
  })
  .strict();

export type AdminUpdatePickupExceptionType = z.infer<typeof AdminUpdatePickupException>;
export const AdminUpdatePickupException = z
  .object({
    fecha: Fecha.optional(),
    stock_location_id: z.string().min(1).nullable().optional(),
    tipo: TipoExcepcion.optional(),
    irrenunciable: z.boolean().optional(),
    capacidad: Cantidad.nullable().optional(),
    motivo: z.string().max(200).nullable().optional(),
  })
  .strict();

export type AdminLoadHolidaysType = z.infer<typeof AdminLoadHolidays>;
export const AdminLoadHolidays = z
  .object({
    anio: z.number().int().min(2000).max(2100),
  })
  .strict();

// Query strings (se validan en la ruta: llegan como texto).
export const AdminListPickupExceptionsQuery = z.object({
  desde: Fecha.optional(),
  hasta: Fecha.optional(),
  stock_location_id: z.string().min(1).optional(),
});

export const AdminPickupOccupancyQuery = z.object({
  stock_location_id: z.string().min(1),
  desde: Fecha.optional(),
  hasta: Fecha.optional(),
});
