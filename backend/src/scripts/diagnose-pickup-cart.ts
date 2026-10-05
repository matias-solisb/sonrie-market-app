import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { getPickupSite, listPickupSites } from "../utils/pickup-sites";

/*

Diagnóstico de "Shipping Options are invalid for cart" al elegir el site.
Solo lee; no modifica nada.

  npx medusa exec ./src/scripts/diagnose-pickup-cart.ts <cart_id> [stock_location_id]

Si no se pasa el site, usa `metadata.stock_location_id` del carrito o, si
no hay, el primer site configurado. Revisa, para la opción "Retiro en
{site}", cada condición que Medusa exige para aceptarla en ese carrito:
canal de venta, país de la dirección vs. zona, reglas, precio en la moneda
del carrito y perfil de envío de los productos.

*/
export default async function diagnosePickupCart({ container, args }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillment = container.resolve(Modules.FULFILLMENT);
  const log = (...m: unknown[]) => console.log(...m);
  const ok = (cond: boolean, msg: string) => log(`${cond ? "✔" : "✘"} ${msg}`);

  const [cartId, siteArg] = args ?? [];

  if (!cartId) {
    log("Uso: npx medusa exec ./src/scripts/diagnose-pickup-cart.ts <cart_id> [stock_location_id]");
    return;
  }

  const {
    data: [cart],
  } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "currency_code",
      "sales_channel_id",
      "metadata",
      "region.id",
      "region.currency_code",
      "region.countries.iso_2",
      "shipping_address.country_code",
      "shipping_address.province",
      "shipping_address.city",
      "shipping_address.postal_code",
      "items.title",
      "items.product.shipping_profile.id",
    ],
    filters: { id: cartId },
  });

  if (!cart) {
    log(`✘ No existe el carrito ${cartId}`);
    return;
  }

  const sites = await listPickupSites(query);
  log(`\nSites configurados: ${sites.map((s) => `${s.name} (${s.id})`).join(", ") || "ninguno"}`);

  const siteId =
    siteArg || (cart.metadata?.stock_location_id as string) || sites[0]?.id;
  const site = siteId ? await getPickupSite(query, siteId) : null;

  if (!site) {
    log(`✘ El stock location ${siteId ?? "-"} no está configurado como site.`);
    return;
  }

  log(`\n== Carrito ${cart.id}`);
  log(`  moneda: ${cart.currency_code} · región: ${cart.region?.id} (${cart.region?.currency_code}) · países: ${(cart.region?.countries ?? []).map((c: any) => c?.iso_2).join(", ")}`);
  log(`  canal: ${cart.sales_channel_id}`);
  log(`  dirección de envío: ${JSON.stringify(cart.shipping_address ?? null)}`);

  log(`\n== Site ${site.name} (${site.id})`);
  log(`  canal del site: ${site.sales_channel_id} · opción: ${site.shipping_option_id}`);
  log(`  dirección del site: ${JSON.stringify(site.address)}`);

  const siteCountry = (site.address?.country_code || "cl").toLowerCase();
  ok(
    (cart.region?.countries ?? []).some((c: any) => c?.iso_2 === siteCountry),
    `La región del carrito incluye el país del site (${siteCountry}).`
  );

  const {
    data: [optionRow],
  } = await query.graph({
    entity: "shipping_option",
    fields: [
      "id",
      "name",
      "price_type",
      "provider_id",
      "shipping_profile_id",
      "rules.attribute",
      "rules.operator",
      "rules.value",
      "prices.currency_code",
      "prices.amount",
      "prices.price_rules.attribute",
      "prices.price_rules.value",
      "service_zone.name",
      "service_zone.geo_zones.type",
      "service_zone.geo_zones.country_code",
      "service_zone.geo_zones.province_code",
      "service_zone.geo_zones.city",
      "service_zone.fulfillment_set.type",
      "service_zone.fulfillment_set.location.id",
    ],
    filters: { id: site.shipping_option_id },
  });
  const option = optionRow as any;

  log(`\n== Opción ${option.name} (${option.id})`);
  log(`  tipo de precio: ${option.price_type} · proveedor: ${option.provider_id} · perfil: ${option.shipping_profile_id}`);
  log(`  reglas: ${JSON.stringify(option.rules?.map((r: any) => [r.attribute, r.operator, r.value]))}`);
  log(`  precios: ${JSON.stringify(option.prices?.map((p: any) => ({ moneda: p.currency_code, monto: p.amount, reglas: p.price_rules })))}`);
  log(`  zona: ${option.service_zone?.name} · geo: ${JSON.stringify(option.service_zone?.geo_zones)}`);
  log(`  set: ${option.service_zone?.fulfillment_set?.type} · ubicación: ${option.service_zone?.fulfillment_set?.location?.id}`);

  log("\n== Chequeos");

  const {
    data: [channel],
  } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "stock_locations.id"],
    filters: { id: site.sales_channel_id },
  });
  ok(
    (channel?.stock_locations ?? []).some((l: any) => l?.id === site.id),
    "El canal del site está asociado a su stock location."
  );

  ok(
    option.service_zone?.fulfillment_set?.location?.id === site.id,
    "La opción pertenece a la ubicación del site."
  );

  const geo = option.service_zone?.geo_zones ?? [];
  ok(
    geo.some((g: any) => g?.type === "country" && g?.country_code === siteCountry),
    `La zona tiene una geo zone tipo "country" para ${siteCountry}.`
  );
  if (geo.some((g: any) => g?.type !== "country")) {
    log("  ⚠ La zona tiene geo zones por provincia/ciudad/código postal: deben calzar exacto con la dirección del site.");
  }

  const context = { is_return: "false", enabled_in_store: "true" };
  const rulesOk = (option.rules ?? []).every((r: any) => {
    const v = (context as any)[r.attribute];
    return r.operator === "eq" ? `${v}` === r.value : true;
  });
  ok(rulesOk, `Las reglas calzan con el contexto de la tienda ${JSON.stringify(context)}.`);

  ok(
    (option.prices ?? []).some(
      (p: any) => p.currency_code === cart.currency_code && !(p.price_rules ?? []).length
    ) ||
      (option.prices ?? []).some((p: any) =>
        (p.price_rules ?? []).some((r: any) => r.attribute === "region_id" && r.value === cart.region?.id)
      ),
    `La opción tiene precio en la moneda del carrito (${cart.currency_code}) o en su región.`
  );

  const profiles = new Set(
    (cart.items ?? []).map((i: any) => i?.product?.shipping_profile?.id ?? null)
  );
  ok(
    [...profiles].every((p) => p === option.shipping_profile_id),
    `Todos los productos del carrito usan el perfil de la opción (${option.shipping_profile_id}). Perfiles en el carrito: ${JSON.stringify([...profiles])}`
  );

  const address = {
    country_code: siteCountry,
    province_code: site.address?.province || undefined,
    city: site.address?.city || undefined,
    postal_expression: site.address?.postal_code || undefined,
  };

  const forContext = await fulfillment.listShippingOptionsForContext({
    id: [option.id],
    context,
    address,
  } as any);
  ok(
    forContext.length === 1,
    `El módulo de fulfillment acepta la opción para la dirección del site ${JSON.stringify(address)}.`
  );

  const contextOnly = await fulfillment.listShippingOptionsForContext({
    id: [option.id],
    context,
  } as any);
  ok(contextOnly.length === 1, "…y sin filtrar por dirección (solo reglas).");
}
