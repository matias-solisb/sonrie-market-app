import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261007151651 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "site_slot_config" drop constraint if exists "site_slot_config_stock_location_id_unique";`);
    this.addSql(`alter table if exists "site_schedule_exception" drop constraint if exists "site_schedule_exception_fecha_unique";`);
    this.addSql(`alter table if exists "site_schedule_exception" drop constraint if exists "site_schedule_exception_fecha_stock_location_id_unique";`);
    this.addSql(`alter table if exists "site_schedule" drop constraint if exists "site_schedule_stock_location_id_dia_semana_unique";`);
    this.addSql(`alter table if exists "pickup_setting" drop constraint if exists "pickup_setting_clave_unique";`);
    this.addSql(`alter table if exists "pickup_occupancy" drop constraint if exists "pickup_occupancy_stock_location_id_fecha_bloque_unique";`);
    this.addSql(`alter table if exists "pickup_occupancy" drop constraint if exists "pickup_occupancy_stock_location_id_fecha_unique";`);
    this.addSql(`alter table if exists "pickup_booking" drop constraint if exists "pickup_booking_order_id_unique";`);
    this.addSql(`alter table if exists "pickup_booking" drop constraint if exists "pickup_booking_cart_id_unique";`);
    this.addSql(`create table if not exists "pickup_booking" ("id" text not null, "cart_id" text not null, "order_id" text null, "stock_location_id" text not null, "fecha" text not null, "bloque" text null, "estado" text check ("estado" in ('reservado', 'confirmado', 'liberado')) not null default 'reservado', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pickup_booking_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pickup_booking_deleted_at" ON "pickup_booking" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pickup_booking_cart_id_unique" ON "pickup_booking" ("cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pickup_booking_order_id_unique" ON "pickup_booking" ("order_id") WHERE order_id IS NOT NULL AND deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pickup_booking_stock_location_id_fecha" ON "pickup_booking" ("stock_location_id", "fecha") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pickup_occupancy" ("id" text not null, "stock_location_id" text not null, "fecha" text not null, "bloque" text null, "ocupados" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pickup_occupancy_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pickup_occupancy_deleted_at" ON "pickup_occupancy" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pickup_occupancy_stock_location_id_fecha_unique" ON "pickup_occupancy" ("stock_location_id", "fecha") WHERE bloque IS NULL AND deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pickup_occupancy_stock_location_id_fecha_bloque_unique" ON "pickup_occupancy" ("stock_location_id", "fecha", "bloque") WHERE bloque IS NOT NULL AND deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pickup_setting" ("id" text not null, "clave" text not null default 'global', "capacidad_por_defecto" integer null, "lead_time_dias" integer not null default 1, "horizonte_dias" integer not null default 14, "dias_abiertos_por_defecto" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pickup_setting_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pickup_setting_deleted_at" ON "pickup_setting" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pickup_setting_clave_unique" ON "pickup_setting" ("clave") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_schedule" ("id" text not null, "stock_location_id" text not null, "dia_semana" integer not null, "abierto" boolean not null default true, "capacidad" integer null, "hora_inicio" text null, "hora_fin" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_schedule_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_schedule_deleted_at" ON "site_schedule" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_schedule_stock_location_id_dia_semana_unique" ON "site_schedule" ("stock_location_id", "dia_semana") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_schedule_exception" ("id" text not null, "fecha" text not null, "stock_location_id" text null, "tipo" text check ("tipo" in ('feriado', 'cerrado', 'abierto')) not null, "irrenunciable" boolean not null default false, "capacidad" integer null, "motivo" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_schedule_exception_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_schedule_exception_deleted_at" ON "site_schedule_exception" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_schedule_exception_fecha_stock_location_id_unique" ON "site_schedule_exception" ("fecha", "stock_location_id") WHERE stock_location_id IS NOT NULL AND deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_schedule_exception_fecha_unique" ON "site_schedule_exception" ("fecha") WHERE stock_location_id IS NULL AND deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_slot_config" ("id" text not null, "stock_location_id" text not null, "capacidad_diaria" integer null, "lead_time_dias" integer null, "horizonte_dias" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_slot_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_slot_config_deleted_at" ON "site_slot_config" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_slot_config_stock_location_id_unique" ON "site_slot_config" ("stock_location_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "pickup_booking" cascade;`);

    this.addSql(`drop table if exists "pickup_occupancy" cascade;`);

    this.addSql(`drop table if exists "pickup_setting" cascade;`);

    this.addSql(`drop table if exists "site_schedule" cascade;`);

    this.addSql(`drop table if exists "site_schedule_exception" cascade;`);

    this.addSql(`drop table if exists "site_slot_config" cascade;`);
  }

}
