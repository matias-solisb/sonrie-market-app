import { expect, test } from "@playwright/test"
import { AUTH_FILE } from "./constants"
import { CartPage, CheckoutPage, StorePage } from "./pages/shop"
import { AdminApi, BACKEND_URL, hasAdmin, loginAdminUi } from "./utils/admin-api"

/*
P-03 · Anular un pedido desde el Admin de Medusa libera su cupo de retiro.

El colaborador compra con fecha de retiro (crea un pedido real en dev, como
el "flujo completo" de purchase-flow.spec.ts) y el administrador lo anula
con el menú del pedido (… → Cancel → Continue). La tarjeta "Retiro" del
pedido pasa a "Anulado", ya no ofrece "Marcar como entregado" y el día
recupera el cupo.

Requisitos: los de purchase-flow.spec.ts ("confirmar pedido") y un usuario
del Admin en .env.e2e (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD). El pedido
que crea el test queda anulado: no toca pedidos existentes.
*/

test.use({ storageState: AUTH_FILE })

test("anular el pedido en el Admin deja el retiro anulado y devuelve el cupo", async ({ page, request }) => {
    test.skip(!hasAdmin, "Falta E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD en .env.e2e")
    test.slow()
    const admin = await AdminApi.login(request)

    // 1. El colaborador compra con fecha de retiro
    const store = new StorePage(page)
    await store.goto()
    await store.addCheapestProduct()
    const cart = new CartPage(page)
    await cart.goto()
    await expect(async () => {
        if (/\/cl\/checkout/.test(page.url())) return
        await cart.checkoutButton.click()
        await expect(page).toHaveURL(/\/cl\/checkout/, { timeout: 10_000 })
    }).toPass({ timeout: 60_000 })

    const checkout = new CheckoutPage(page)
    const fecha = await checkout.chooseFirstDate()
    await expect(checkout.placeOrder).toBeEnabled({ timeout: 30_000 })
    await checkout.placeOrder.click()
    await expect(page).toHaveURL(/\/cl\/order\/confirmed\//, { timeout: 30_000 })
    const orderId = page.url().match(/\/order\/confirmed\/([^/?#]+)/)![1]

    let booking: any
    await expect(async () => {
        booking = await admin.bookingOf(orderId)
        expect(booking?.estado).toBe("agendado")
    }).toPass({ timeout: 30_000 })
    expect(booking.fecha).toBe(fecha)
    const ocupadosAntes = await admin.ocupados(booking.stock_location_id, fecha)

    // 2. El administrador lo anula desde el detalle del pedido
    await loginAdminUi(page)
    await page.goto(`${BACKEND_URL}/app/orders/${orderId}`)
    const widget = page.getByTestId("order-pickup-date")
    await expect(widget).toBeVisible({ timeout: 30_000 })
    await expect(widget).toContainText(/Agendado|Retira hoy/)
    await expect(page.getByTestId("order-pickup-entregar")).toBeVisible()

    const titulo = page.getByRole("heading", { name: `#${booking.order.display_id}` })
    await titulo
        .locator("xpath=ancestor::div[contains(@class,'justify-between')][1]")
        .getByRole("button")
        .last()
        .click()
    await page.getByRole("menuitem", { name: "Cancel" }).click()
    const confirmar = page.getByRole("alertdialog")
    await expect(confirmar).toContainText(`#${booking.order.display_id}`)
    await confirmar.getByRole("button", { name: "Continue" }).click()

    // 3. Retiro anulado y cupo devuelto
    await expect(widget).toContainText("Anulado", { timeout: 30_000 })
    await expect(page.getByTestId("order-pickup-entregar")).toHaveCount(0)

    await expect(async () => {
        expect((await admin.bookingOf(orderId)).estado).toBe("anulado")
    }).toPass({ timeout: 30_000 })
    expect(await admin.ocupados(booking.stock_location_id, fecha)).toBe(ocupadosAntes - 1)

    // Ya no aparece entre los pedidos agendados de ese día
    const { bookings } = await admin.get(`/admin/pickup-scheduling/bookings?fecha=${fecha}`)
    expect(bookings.map((b: any) => b.order_id)).not.toContain(orderId)
})
