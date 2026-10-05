import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261002183231 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "benefit_movement" drop constraint if exists "benefit_movement_order_id_tipo_unique";`);
    this.addSql(`alter table if exists "benefit_movement" drop constraint if exists "benefit_movement_cart_id_tipo_unique";`);
    this.addSql(`alter table if exists "employee_budget" drop constraint if exists "employee_budget_customer_id_campaign_id_periodo_unique";`);
    this.addSql(`create table if not exists "benefit_campaign" ("id" text not null, "nombre" text not null, "descripcion" text null, "tope_por_colaborador" integer not null, "periodo" text check ("periodo" in ('mensual', 'rango')) not null default 'mensual', "fecha_inicio" timestamptz null, "fecha_fin" timestamptz null, "modo_exceso" text check ("modo_exceso" in ('bloqueo_duro', 'requiere_aprobacion')) not null default 'bloqueo_duro', "estado" text check ("estado" in ('activa', 'inactiva')) not null default 'activa', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "benefit_campaign_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_benefit_campaign_deleted_at" ON "benefit_campaign" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "employee_budget" ("id" text not null, "customer_id" text not null, "periodo" text not null, "tope" integer not null, "tope_override" integer null, "consumido" integer not null default 0, "campaign_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "employee_budget_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_employee_budget_campaign_id" ON "employee_budget" ("campaign_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_employee_budget_deleted_at" ON "employee_budget" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_employee_budget_customer_id_campaign_id_periodo_unique" ON "employee_budget" ("customer_id", "campaign_id", "periodo") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_employee_budget_customer_id" ON "employee_budget" ("customer_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "benefit_movement" ("id" text not null, "tipo" text check ("tipo" in ('consumo', 'reintegro')) not null, "monto" integer not null, "cart_id" text null, "order_id" text null, "presupuesto_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "benefit_movement_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_benefit_movement_presupuesto_id" ON "benefit_movement" ("presupuesto_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_benefit_movement_deleted_at" ON "benefit_movement" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_benefit_movement_cart_id_tipo_unique" ON "benefit_movement" ("cart_id", "tipo") WHERE cart_id IS NOT NULL AND deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_benefit_movement_order_id_tipo_unique" ON "benefit_movement" ("order_id", "tipo") WHERE order_id IS NOT NULL AND deleted_at IS NULL;`);

    this.addSql(`alter table if exists "employee_budget" add constraint "employee_budget_campaign_id_foreign" foreign key ("campaign_id") references "benefit_campaign" ("id") on update cascade;`);

    this.addSql(`alter table if exists "benefit_movement" add constraint "benefit_movement_presupuesto_id_foreign" foreign key ("presupuesto_id") references "employee_budget" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "employee_budget" drop constraint if exists "employee_budget_campaign_id_foreign";`);

    this.addSql(`alter table if exists "benefit_movement" drop constraint if exists "benefit_movement_presupuesto_id_foreign";`);

    this.addSql(`drop table if exists "benefit_campaign" cascade;`);

    this.addSql(`drop table if exists "employee_budget" cascade;`);

    this.addSql(`drop table if exists "benefit_movement" cascade;`);
  }

}
