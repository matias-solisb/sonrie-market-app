import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/*

Estados del cupo de retiro con nombres que describen el retiro, más el
estado `retirado` (ver models/pickup-booking.ts):

  reservado  → pendiente
  confirmado → agendado
  liberado   → anulado
  (nuevo)      retirado, con retirado_at / retirado_por / retirado_por_email

Orden: primero se suelta el check, después se migran las filas y al final
se pone el check nuevo (si no, el UPDATE choca con el check viejo).

*/
export class Migration20261014120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pickup_booking" drop constraint if exists "pickup_booking_estado_check";`);

    this.addSql(`
      update "pickup_booking" set "estado" = case "estado"
        when 'reservado' then 'pendiente'
        when 'confirmado' then 'agendado'
        when 'liberado' then 'anulado'
        else "estado"
      end;
    `);

    this.addSql(`alter table if exists "pickup_booking" alter column "estado" set default 'pendiente';`);
    this.addSql(`alter table if exists "pickup_booking" add constraint "pickup_booking_estado_check" check ("estado" in ('pendiente', 'agendado', 'retirado', 'anulado'));`);

    this.addSql(`alter table if exists "pickup_booking" add column if not exists "retirado_at" timestamptz null;`);
    this.addSql(`alter table if exists "pickup_booking" add column if not exists "retirado_por" text null;`);
    this.addSql(`alter table if exists "pickup_booking" add column if not exists "retirado_por_email" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "pickup_booking" drop constraint if exists "pickup_booking_estado_check";`);

    // `retirado` no existía: vuelve a `confirmado` (el pedido seguía con su cupo).
    this.addSql(`
      update "pickup_booking" set "estado" = case "estado"
        when 'pendiente' then 'reservado'
        when 'agendado' then 'confirmado'
        when 'retirado' then 'confirmado'
        when 'anulado' then 'liberado'
        else "estado"
      end;
    `);

    this.addSql(`alter table if exists "pickup_booking" alter column "estado" set default 'reservado';`);
    this.addSql(`alter table if exists "pickup_booking" add constraint "pickup_booking_estado_check" check ("estado" in ('reservado', 'confirmado', 'liberado'));`);

    this.addSql(`alter table if exists "pickup_booking" drop column if exists "retirado_at";`);
    this.addSql(`alter table if exists "pickup_booking" drop column if exists "retirado_por";`);
    this.addSql(`alter table if exists "pickup_booking" drop column if exists "retirado_por_email";`);
  }

}
