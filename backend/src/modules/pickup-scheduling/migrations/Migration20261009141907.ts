import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/*

Auditoría de la agenda (pickup_schedule_change):

1. `actor_email`: correo del usuario del Admin al momento del cambio, para
   que el historial lo conserve aunque el usuario se elimine.
2. Solo lectura: un trigger rechaza UPDATE y DELETE (incluido el borrado
   lógico, que es un UPDATE de deleted_at). La auditoría solo se agrega.
   TRUNCATE no pasa por triggers de fila: lo usan los tests para limpiar.

*/
export class Migration20261009141907 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pickup_schedule_change" add column if not exists "actor_email" text null;`);

    this.addSql(`
      create or replace function "pickup_schedule_change_solo_lectura"() returns trigger as $$
      begin
        raise exception 'pickup_schedule_change es de solo lectura: la auditoría no se edita ni se borra.';
      end;
      $$ language plpgsql;
    `);
    this.addSql(`drop trigger if exists "pickup_schedule_change_solo_lectura" on "pickup_schedule_change";`);
    this.addSql(`
      create trigger "pickup_schedule_change_solo_lectura"
        before update or delete on "pickup_schedule_change"
        for each row execute function "pickup_schedule_change_solo_lectura"();
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop trigger if exists "pickup_schedule_change_solo_lectura" on "pickup_schedule_change";`);
    this.addSql(`drop function if exists "pickup_schedule_change_solo_lectura"();`);
    this.addSql(`alter table if exists "pickup_schedule_change" drop column if exists "actor_email";`);
  }

}
