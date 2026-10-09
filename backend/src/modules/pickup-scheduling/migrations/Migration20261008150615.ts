import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261008150615 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "pickup_schedule_change" ("id" text not null, "actor_id" text null, "entidad" text check ("entidad" in ('configuracion', 'site', 'horario', 'excepcion')) not null, "accion" text check ("accion" in ('crear', 'editar', 'eliminar')) not null, "stock_location_id" text null, "referencia" text null, "cambios" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pickup_schedule_change_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pickup_schedule_change_deleted_at" ON "pickup_schedule_change" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pickup_schedule_change_created_at" ON "pickup_schedule_change" ("created_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "pickup_schedule_change" cascade;`);
  }

}
