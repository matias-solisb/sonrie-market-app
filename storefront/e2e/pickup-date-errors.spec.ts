import { expect, test, type Page } from "@playwright/test"
import { AUTH_FILE } from "./constants"
import { CartPage, CheckoutPage, StorePage } from "./pages/shop"
import { AdminApi, AgendaCleanup, fechaChile, hasAdmin } from "./utils/admin-api"

/*
La fecha de retiro deja de servir entre que el colaborador la eligió y que
confirma el pedido. En todos los casos el checkout tiene que decirlo con
claridad, no dejar confirmar y permitir elegir otra fecha sin perder el
carrito. Ningún test de este archivo crea pedidos.

- El Admin cierra el día después de que el colaborador lo eligió.
- La fecha guardada ya no está en el rango (carrito que quedó de un día
  para otro: se simula subiendo la anticipación del site).
- El día se llena mientras el colaborador está en el checkout: el error del
  backend aparece al confirmar.

Requisitos: los de purchase-flow.spec.ts ("confirmar pedido") y un usuario
del Admin en .env.e2e (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD) para cerrar
días y cambiar la anticipación. Sin ese usuario, se saltan. Cada test
deshace lo que cambió en la agenda (afterEach, también si falla).
*/

test.use({ storageState: AUTH_FILE })
test.describe.configure({ mode: "serial" })

const cleanup = new AgendaCleanup()

test.beforeEach(() => {
    test.skip(!hasAdmin, "Falta E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD en .env.e2e")
    // Carrito + checkout + cambios de agenda + recargas: con `next dev`
    // cada página compila la primera vez.
    test.slow()
})

test.afterEach(({ request }) => cleanup.run(request))

async function checkoutWithDate(page: Page) {
    const store = new StorePage(page)
    await store.goto()
    await store.addCheapestProduct()
    const cart = new CartPage(page)
    await cart.goto()
    // Con `next dev` el botón se ve (HTML del servidor) antes de que React
    // lo hidrate: un clic en ese momento se pierde. Se reintenta hasta que
    // navegue (confirmar el carrito es idempotente).
    await expect(async () => {
        if (/\/cl\/checkout/.test(page.url())) return
        await cart.checkoutButton.click()
        await expect(page).toHaveURL(/\/cl\/checkout/, { timeout: 10_000 })
    }).toPass({ timeout: 60_000 })

    const checkout = new CheckoutPage(page)
    const fecha = await checkout.chooseFirstDate()
    await expect(checkout.placeOrder).toBeEnabled({ timeout: 30_000 })
    const siteName = (await checkout.pickupSiteName.textContent()) ?? ""
    return { checkout, fecha, siteName }
}

/** La fecha guardada ya no sirve: aviso, botón bloqueado y se corrige con otra. */
async function expectCanFixDate(page: Page, checkout: CheckoutPage, fecha: string, aviso: RegExp) {
    await expect(checkout.invalidDate).toBeVisible({ timeout: 30_000 })
    await expect(checkout.invalidDate).toContainText(aviso)
    await expect(checkout.placeOrder).toBeDisabled()
    await expect(checkout.disabledReason).toHaveText(
        "Elige una fecha de retiro para confirmar el pedido."
    )
    await expect(
        page.locator(`[data-testid="pickup-date-option"][data-fecha="${fecha}"][data-disponible="true"]`)
    ).toHaveCount(0)

    const otra = await checkout.chooseFirstDate()
    expect(otra).not.toBe(fecha)
    await expect(checkout.placeOrder).toBeEnabled({ timeout: 30_000 })
    await expect(checkout.invalidDate).toHaveCount(0)
}

test("el Admin cierra el día después de que lo elegí: aviso con el motivo y elijo otra fecha", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    const { checkout, fecha, siteName } = await checkoutWithDate(page)
    const siteId = await admin.siteIdByName(siteName)

    const excId = await admin.createException({
        fecha,
        stock_location_id: siteId,
        tipo: "cerrado",
        motivo: "Cierre e2e",
    })
    cleanup.add((a) => a.deleteException(excId))

    await page.reload()
    await expectCanFixDate(page, checkout, fecha, /ya no está disponible \(Cierre e2e\)/)
})

test("la fecha guardada quedó fuera del rango (carrito de un día para otro): aviso y elijo otra", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    const { checkout, fecha, siteName } = await checkoutWithDate(page)
    const siteId = await admin.siteIdByName(siteName)
    const original = await admin.siteConfig(siteId)

    // La fecha elegida queda antes del primer día elegible, igual que
    // cuando el carrito se deja de un día para otro.
    let dias = 0
    while (fechaChile(dias) !== fecha) dias++
    cleanup.add((a) =>
        a.updateSite(siteId, {
            lead_time_dias: original?.lead_time_dias ?? null,
            horizonte_dias: original?.horizonte_dias ?? null,
        })
    )
    await admin.updateSite(siteId, {
        lead_time_dias: dias + 1,
        horizonte_dias: dias + 15,
    })

    await page.reload()
    await expectCanFixDate(page, checkout, fecha, /ya no está disponible para retiro/)
})

test("el día se llena mientras estoy en el checkout: al confirmar veo el error y elijo otra fecha", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    const { checkout, fecha, siteName } = await checkoutWithDate(page)
    const siteId = await admin.siteIdByName(siteName)

    // Mismo efecto que otros colaboradores tomando los últimos cupos.
    const excId = await admin.createException({
        fecha,
        stock_location_id: siteId,
        tipo: "abierto",
        capacidad: 0,
    })
    cleanup.add((a) => a.deleteException(excId))

    // Sin recargar: la página todavía muestra la fecha como válida.
    await expect(checkout.placeOrder).toBeEnabled()
    await checkout.placeOrder.click()

    await expect(checkout.orderError).toContainText("No quedan cupos de retiro", { timeout: 30_000 })
    await expect(page).toHaveURL(/\/cl\/checkout/)

    await page.reload()
    await expectCanFixDate(page, checkout, fecha, /ya no está disponible/)
})
