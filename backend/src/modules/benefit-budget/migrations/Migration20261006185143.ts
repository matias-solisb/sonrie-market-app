import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261006185143 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "benefit_campaign_change" ("id" text not null, "actor_id" text null, "cambios" jsonb not null, "rige_desde" text null, "campaign_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "benefit_campaign_change_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_benefit_campaign_change_campaign_id" ON "benefit_campaign_change" ("campaign_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_benefit_campaign_change_deleted_at" ON "benefit_campaign_change" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "benefit_campaign_change" add constraint "benefit_campaign_change_campaign_id_foreign" foreign key ("campaign_id") references "benefit_campaign" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "benefit_campaign_change" cascade;`);
  }

}
