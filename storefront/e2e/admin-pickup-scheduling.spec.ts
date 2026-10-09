import { expect, test, type Page } from "@playwright/test"
import {
    AdminApi,
    AgendaCleanup,
    BACKEND_URL,
    fechaChile,
    hasAdmin,
    loginAdminUi,
} from "./utils/admin-api"

/*
Página "Agenda de retiro" del Admin (backend, /app/pickup-scheduling) y
widget "Retiro" del detalle del pedido.

Corre contra el Admin del backend de dev (E2E_BACKEND_URL, por defecto
http://localhost:9000) con el usuario de E2E_ADMIN_EMAIL /
E2E_ADMIN_PASSWORD; sin él, se salta. Cada test borra las excepciones que
crea (por motivo "E2E …", en afterEach: también si falla o se pasa del
tiempo).
*/

test.describe.configure({ mode: "serial" })

const cleanup = new AgendaCleanup()

test.beforeEach(async ({ page }) => {
    test.skip(!hasAdmin, "Falta E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD en .env.e2e")
    test.slow()
    await loginAdminUi(page)
})

test.afterEach(({ request }) => cleanup.run(request))

const AGENDA = `${BACKEND_URL}/app/pickup-scheduling`

/** Al terminar el test, borra las excepciones de esa fecha con ese motivo. */
const cleanupExceptions = (fecha: string, motivo: string) =>
    cleanup.add((admin) => admin.deleteExceptionsByMotivo(fecha, motivo))

/** Abre Calendario en el año de `fecha`. */
async function openCalendar(page: Page, fecha: string) {
    await page.getByRole("tab", { name: "Calendario" }).click()
    const anio = Number(fecha.slice(0, 4))
    const actual = Number(fechaChile(0).slice(0, 4))
    for (let i = actual; i < anio; i++) {
        await page.getByRole("button", { name: "→" }).click()
    }
    await expect(page.getByText(String(anio), { exact: true })).toBeVisible()
}

/** Llena y guarda el formulario de nueva excepción (cerrado, todos los sites). */
async function addClosedDay(page: Page, fecha: string, motivo: string) {
    await page.getByRole("button", { name: "Agregar excepción" }).click()
    const drawer = page.getByRole("dialog")
    await drawer.locator("#exc-fecha").fill(fecha)
    await drawer.locator("#exc-motivo").fill(motivo)
    await drawer.getByRole("button", { name: "Guardar" }).click()
}

/** Primer día de los próximos 14 con un pedido agendado (o null). */
async function dayWithOrder(admin: AdminApi) {
    for (let d = 0; d < 14; d++) {
        const fecha = fechaChile(d)
        const { bookings } = await admin.get(`/admin/pickup-scheduling/bookings?fecha=${fecha}`)
        const conPedido = bookings.find((b: any) => b.order)
        if (conPedido) return { fecha, booking: conPedido }
    }
    return null
}

test("muestra la agenda con sus cinco pestañas", async ({ page }) => {
    await page.goto(AGENDA)

    await expect(page.getByRole("heading", { name: "Agenda de retiro" })).toBeVisible({ timeout: 30_000 })
    for (const tab of ["General", "Sites", "Calendario", "Ocupación", "Historial"]) {
        await expect(page.getByRole("tab", { name: tab })).toBeVisible()
    }
    await expect(page.locator("#cap-general")).toBeVisible()

    await page.getByRole("tab", { name: "Ocupación" }).click()
    await expect(page.getByRole("table")).toBeVisible()
})

test("crea una excepción, queda en el historial y se elimina", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    // Lejos del rango que ve el colaborador (no toca pedidos ni otros
    // tests) y sin otra excepción ese día (p. ej. un feriado).
    const fecha = await admin.freeDate(60)
    const motivo = `E2E excepción ${Date.now()}`
    cleanupExceptions(fecha, motivo)

    await page.goto(AGENDA)
    await openCalendar(page, fecha)
    await addClosedDay(page, fecha, motivo)

    await expect(page.getByText("Excepción creada.")).toBeVisible({ timeout: 15_000 })
    const row = page.getByRole("row").filter({ hasText: motivo })
    await expect(row).toBeVisible()
    await expect(row).toContainText("Todos los sites")
    await expect(row).toContainText("Cerrado")

    await page.getByRole("tab", { name: "Historial" }).click()
    const cambio = page.getByRole("row").filter({ hasText: motivo }).first()
    await expect(cambio).toContainText("Calendario (creó)")

    await openCalendar(page, fecha)
    await page.getByRole("row").filter({ hasText: motivo })
        .getByRole("button", { name: "Eliminar excepción" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click()

    await expect(page.getByText("Excepción eliminada.")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("row").filter({ hasText: motivo })).toHaveCount(0)
    expect((await admin.exceptionsOn(fecha)).filter((e) => e.motivo === motivo)).toHaveLength(0)
})

test("avisa antes de cerrar un día con pedidos y después los lista para avisarles", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    const found = await dayWithOrder(admin)
    test.skip(!found, "No hay pedidos agendados en los próximos 14 días")
    const { fecha, booking } = found!
    const motivo = `E2E conflicto ${Date.now()}`
    cleanupExceptions(fecha, motivo)

    await page.goto(AGENDA)
    await openCalendar(page, fecha)
    await addClosedDay(page, fecha, motivo)

    const aviso = page.getByRole("alertdialog")
    await expect(aviso).toContainText("Hay pedidos agendados ese día")
    await expect(aviso).toContainText("no los anula ni los mueve")
    await aviso.getByRole("button", { name: "Guardar igual" }).click()
    await expect(page.getByText("Excepción creada.")).toBeVisible({ timeout: 15_000 })

    const conflictos = page.getByTestId("pickup-conflicts")
    await expect(conflictos).toBeVisible({ timeout: 15_000 })
    await expect(conflictos).toContainText(`#${booking.order.display_id}`)
    await expect(conflictos).toContainText(motivo)

    await admin.deleteExceptionsByMotivo(fecha, motivo)
    await page.reload()
    await expect(
        page.getByTestId("pickup-conflicts").filter({ hasText: motivo })
    ).toHaveCount(0)
})

test("cancelar el aviso no cierra el día", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    const found = await dayWithOrder(admin)
    test.skip(!found, "No hay pedidos agendados en los próximos 14 días")
    const { fecha } = found!
    const motivo = `E2E cancelado ${Date.now()}`
    cleanupExceptions(fecha, motivo)

    await page.goto(AGENDA)
    await openCalendar(page, fecha)
    await addClosedDay(page, fecha, motivo)

    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar" }).click()
    await expect(page.getByRole("alertdialog")).toHaveCount(0)

    expect((await admin.exceptionsOn(fecha)).filter((e) => e.motivo === motivo)).toHaveLength(0)
})

test("el detalle del pedido muestra el site y la fecha de retiro", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    const found = await dayWithOrder(admin)
    test.skip(!found, "No hay pedidos agendados en los próximos 14 días")
    const { booking } = found!

    await page.goto(`${BACKEND_URL}/app/orders/${booking.order.id}`)

    const widget = page.getByTestId("order-pickup-date")
    await expect(widget).toBeVisible({ timeout: 30_000 })
    await expect(widget).toContainText("Retiro")
    await expect(widget).toContainText("Confirmado")
    await expect(page.getByTestId("order-pickup-site")).toHaveText(booking.site_name)

    const dia = Number(booking.fecha.slice(8, 10))
    await expect(page.getByTestId("order-pickup-fecha")).toContainText(` ${dia} de `)
})
