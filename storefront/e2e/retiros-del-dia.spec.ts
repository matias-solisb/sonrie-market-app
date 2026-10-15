import { expect, test } from "@playwright/test"
import { AdminApi, BACKEND_URL, hasAdmin, loginAdminUi } from "./utils/admin-api"

/*
Pantalla "Retiros del día" del Admin (backend, /app/retiros): paginación de
"No retirados" y búsqueda. Solo lee: no entrega ni anula pedidos.

Usa los datos del ambiente de dev: la paginación necesita un site con más
de 10 pedidos no retirados (agendados de días anteriores) y la búsqueda,
algún pedido visible. Si no los hay, esos tests se saltan.
*/

test.describe.configure({ mode: "serial" })

test.beforeEach(async ({ page }) => {
    test.skip(!hasAdmin, "Falta E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD en .env.e2e")
    test.slow()
    await loginAdminUi(page)
})

const RETIROS = `${BACKEND_URL}/app/retiros`

/** Site con más no retirados (y su resumen), o null si no hay sites. */
async function siteConMasNoRetirados(admin: AdminApi) {
    let mejor: { id: string; name: string; data: any } | null = null
    for (const site of await admin.pickupSites()) {
        const data = await admin.get(`/admin/pickup-scheduling/retiros?stock_location_id=${site.id}`)
        if (!mejor || data.resumen.no_retirados > mejor.data.resumen.no_retirados) {
            mejor = { id: site.id, name: site.name, data }
        }
    }
    return mejor
}

async function elegirSite(page: import("@playwright/test").Page, nombre: string) {
    await expect(page.getByRole("heading", { name: "Retiros del día" })).toBeVisible({ timeout: 30_000 })
    const trigger = page.locator("#retiros-site")
    if (!((await trigger.textContent()) ?? "").includes(nombre)) {
        await trigger.click()
        await page.getByRole("option", { name: nombre }).click()
    }
    await expect(trigger).toContainText(nombre)
}

test("No retirados se ve de 10 en 10 y se avanza con Siguientes / Anteriores", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    const site = await siteConMasNoRetirados(admin)
    const total = site?.data.resumen.no_retirados ?? 0
    test.skip(total <= 10, "Se necesita un site con más de 10 pedidos no retirados en dev")

    await page.goto(RETIROS)
    await elegirSite(page, site!.name)
    await expect(page.getByTestId("retiros-pestana-no_retirados")).toContainText(String(total))
    await page.getByTestId("retiros-pestana-no_retirados").click()

    const filas = page.getByTestId("retiros-fila")
    const texto = page.getByTestId("retiros-paginador-texto")
    await expect(filas).toHaveCount(10)
    await expect(texto).toHaveText(`1 a 10 de ${total} pedidos · página 1 de ${Math.ceil(total / 10)}`)
    await expect(page.getByRole("button", { name: "Anteriores" })).toBeDisabled()

    const primero = await filas.first().textContent()
    await page.getByRole("button", { name: "Siguientes" }).click()
    await expect(texto).toContainText(`11 a ${Math.min(20, total)} de ${total}`)
    await expect(filas.first()).not.toHaveText(primero ?? "")

    await page.getByRole("button", { name: "Anteriores" }).click()
    await expect(texto).toContainText(`1 a 10 de ${total}`)

    // Cambiar de pestaña y volver reinicia en la página 1
    await page.getByRole("button", { name: "Siguientes" }).click()
    await expect(texto).toContainText("página 2")
    await page.getByTestId("retiros-pestana-por_entregar").click()
    await page.getByTestId("retiros-pestana-no_retirados").click()
    await expect(texto).toContainText("página 1")
})

test("la búsqueda por n.º de pedido encuentra el pedido aunque sea de otro día", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    const site = await siteConMasNoRetirados(admin)
    const pedido = site?.data.no_retirados[0] ?? site?.data.retiros[0]
    test.skip(!pedido?.display_id, "No hay pedidos visibles en Retiros del día en dev")

    await page.goto(RETIROS)
    await elegirSite(page, site!.name)
    await page.getByTestId("retiros-buscar").fill(`#${pedido.display_id}`)

    await expect(page.getByRole("heading", { name: `Resultados para «#${pedido.display_id}»` })).toBeVisible({ timeout: 15_000 })
    const filas = page.getByTestId("retiros-fila")
    await expect(filas).toHaveCount(1)
    await expect(filas.first()).toContainText(`#${pedido.display_id}`)
    await expect(page.getByTestId("retiros-paginador")).toHaveCount(0)

    await page.getByRole("button", { name: "Limpiar búsqueda" }).click()
    await expect(page.getByTestId("retiros-buscar")).toHaveValue("")
})
