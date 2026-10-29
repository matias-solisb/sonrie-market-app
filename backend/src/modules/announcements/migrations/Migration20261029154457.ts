import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261029154457 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "announcement_setting" drop constraint if exists "announcement_setting_clave_unique";`);
    this.addSql(`create table if not exists "announcement" ("id" text not null, "nombre" text not null, "texto" text not null, "link" text null, "icono" text check ("icono" in ('camion', 'calendario', 'reloj', 'info', 'alerta', 'regalo', 'oferta', 'tienda', 'ubicacion', 'campana', 'destacado')) null, "posicion_icono" text check ("posicion_icono" in ('izquierda', 'derecha')) not null default 'izquierda', "fecha_inicio" timestamptz null, "fecha_fin" timestamptz null, "activo" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "announcement_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_announcement_deleted_at" ON "announcement" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "announcement_setting" ("id" text not null, "clave" text not null default 'global', "intervalo_segundos" integer not null default 5, "lugares" jsonb not null, "color_fondo" text not null default '#E01441', "color_texto" text not null default '#FFFFFF', "color_borde" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "announcement_setting_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_announcement_setting_deleted_at" ON "announcement_setting" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_announcement_setting_clave_unique" ON "announcement_setting" ("clave") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "announcement" cascade;`);

    this.addSql(`drop table if exists "announcement_setting" cascade;`);
  }

}
