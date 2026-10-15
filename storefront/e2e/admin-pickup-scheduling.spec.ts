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
    await expect(widget).toContainText(/Agendado|Retira hoy/)
    await expect(page.getByTestId("order-pickup-site")).toHaveText(booking.site_name)

    const dia = Number(booking.fecha.slice(8, 10))
    await expect(page.getByTestId("order-pickup-fecha")).toContainText(` ${dia} de `)
})

// ─────────────────────────────────────────────────────────────
// Panel del site (P-01 y P-04) y carga de feriados (P-02)
// ─────────────────────────────────────────────────────────────

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
const CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

/**
 * Primer site y un día de la semana sin horario propio (si todos lo
 * tienen, el lunes). Al terminar el test, ese día vuelve a como estaba.
 */
async function siteAndFreeDay(admin: AdminApi) {
    const [site] = (await admin.pickupSites()) as any[]
    test.skip(!site, "No hay sites de retiro configurados")
    const usados = new Set(site.horario.map((h: any) => h.dia_semana))
    const dia = [1, 2, 3, 4, 5, 6, 7].find((d) => !usados.has(d)) ?? 1
    const original = await admin.siteDay(site.id, dia)
    const config = await admin.siteConfig(site.id)
    cleanup.add(async (a) => {
        await a.setSiteDay(site.id, dia, original)
        if (config) await a.updateSite(site.id, config)
    })
    return { site, dia, original, config }
}

/** Abre el panel "Agenda de {site}" desde la pestaña Sites. */
async function openSitePanel(page: Page, siteName: string) {
    await page.getByRole("tab", { name: "Sites" }).click()
    await page.getByRole("button", { name: `Editar ${siteName}` }).click()
    const drawer = page.getByRole("dialog")
    await expect(drawer.getByText(`Agenda de ${siteName}`)).toBeVisible()
    return drawer
}

/** Elige el modo de un día en el panel: "Abierto", "Cerrado" o General. */
async function setDayMode(page: Page, dia: number, mode: "Abierto" | "Cerrado" | RegExp) {
    const drawer = page.getByRole("dialog")
    await drawer.getByRole("combobox", { name: `Horario del ${DIAS[dia - 1]}` }).click()
    await page.getByRole("option", { name: mode, exact: typeof mode === "string" }).click()
}

const siteRow = (page: Page, siteName: string) =>
    page.getByRole("row").filter({ hasText: siteName })

// P-01
test("define y quita el horario semanal de un site desde su panel", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    const { site, dia } = await siteAndFreeDay(admin)
    const resumen = `${CORTO[dia - 1]}: abierto, 3 cupos`

    await page.goto(AGENDA)
    let drawer = await openSitePanel(page, site.name)
    await setDayMode(page, dia, "Abierto")
    await drawer.getByLabel(`Capacidad del ${DIAS[dia - 1]}`).fill("3")
    await drawer.getByRole("button", { name: "Guardar" }).click()

    await expect(page.getByText(`Agenda de ${site.name} guardada.`)).toBeVisible({ timeout: 15_000 })
    await expect(siteRow(page, site.name)).toContainText(resumen)
    expect(await admin.siteDay(site.id, dia)).toEqual({ abierto: true, capacidad: 3 })

    // Quedó en el historial como cambio del horario.
    await page.getByRole("tab", { name: "Historial" }).click()
    await expect(page.getByRole("row").filter({ hasText: site.name }).first()).toBeVisible()

    // Volver al horario general
    drawer = await openSitePanel(page, site.name)
    await setDayMode(page, dia, /^General/)
    await drawer.getByRole("button", { name: "Guardar" }).click()

    await expect(page.getByText(`Agenda de ${site.name} guardada.`).last()).toBeVisible({ timeout: 15_000 })
    await expect(siteRow(page, site.name)).not.toContainText(`${CORTO[dia - 1]}:`)
    expect(await admin.siteDay(site.id, dia)).toBeNull()
})

// P-04
test("si el guardado del panel falla, no queda nada guardado y el panel sigue abierto", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    const { site, dia, original, config } = await siteAndFreeDay(admin)

    // El panel no deja guardar un horizonte menor que la anticipación, así
    // que se agrega en camino al backend: el día va primero y es válido; la
    // configuración falla después y tiene que deshacerlo.
    await page.route("**/admin/pickup-scheduling/sites/*/agenda", async (route) => {
        const body = route.request().postDataJSON()
        await route.continue({
            postData: JSON.stringify({ ...body, config: { lead_time_dias: 10, horizonte_dias: 5 } }),
        })
    })

    await page.goto(AGENDA)
    const drawer = await openSitePanel(page, site.name)
    await setDayMode(page, dia, "Abierto")
    await drawer.getByLabel(`Capacidad del ${DIAS[dia - 1]}`).fill("4")
    await drawer.getByRole("button", { name: "Guardar" }).click()

    await expect(page.getByText(/horizonte no puede ser menor.*No se guardó ningún cambio\./)).toBeVisible({ timeout: 15_000 })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByLabel(`Capacidad del ${DIAS[dia - 1]}`)).toHaveValue("4")

    expect(await admin.siteDay(site.id, dia)).toEqual(original)
    expect(await admin.siteConfig(site.id)).toEqual(config)
})

// P-02
test("carga los feriados de Chile de un año y avisa si ya estaban cargados", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    const anios = await admin.holidayYears()
    const globales = async (anio: number) =>
        (await admin.exceptionsBetween(`${anio}-01-01`, `${anio}-12-31`)).filter(
            (e) => !e.stock_location_id
        )

    // Un año con lista de feriados y sin ninguno cargado: se prueba la carga
    // completa y después se borran solo los que creó el test.
    let anio: number | undefined
    for (const a of anios) {
        if (a >= Number(fechaChile(0).slice(0, 4)) && !(await globales(a)).some((e) => e.tipo === "feriado")) {
            anio = a
            break
        }
    }
    test.skip(!anio, "Todos los años con lista de feriados ya están cargados")
    const antes = new Set((await globales(anio!)).map((e) => e.id))
    cleanup.add(async (a) => {
        const todas = await a.exceptionsBetween(`${anio}-01-01`, `${anio}-12-31`)
        for (const e of todas.filter((x) => !x.stock_location_id && !antes.has(x.id))) {
            await a.deleteException(e.id)
        }
    })

    await page.goto(AGENDA)
    await openCalendar(page, `${anio}-01-01`)
    const cargar = page.getByRole("button", { name: `Cargar feriados de Chile ${anio}` })

    // Cancelar el aviso no carga nada
    await cargar.click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar" }).click()
    expect((await globales(anio!)).length).toBe(antes.size)

    await cargar.click()
    await expect(page.getByRole("alertdialog")).toContainText("ningún site podrá abrir esos días")
    await page.getByRole("alertdialog").getByRole("button", { name: "Cargar" }).click()

    const aviso = page.getByText(/^\d+ feriados cargados/)
    await expect(aviso).toBeVisible({ timeout: 15_000 })
    const nuevos = (await globales(anio!)).filter((e) => !antes.has(e.id))
    expect(nuevos.length).toBeGreaterThan(0)
    expect(nuevos.every((e) => e.tipo === "feriado")).toBe(true)
    expect(nuevos.some((e) => e.irrenunciable)).toBe(true)
    await expect(aviso).toHaveText(new RegExp(`^${nuevos.length} feriados cargados`))

    // Aparecen en la lista del año, como cerrados
    const primero = nuevos.sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
    await expect(page.getByRole("row").filter({ hasText: primero.motivo }).first()).toBeVisible()

    // Segunda vez: idempotente
    await cargar.click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Cargar" }).click()
    await expect(page.getByText("Los feriados de ese año ya estaban cargados.")).toBeVisible({ timeout: 15_000 })
    expect((await globales(anio!)).length).toBe(antes.size + nuevos.length)
})

// D1: el historial muestra el nombre del site, no su id interno.
test("el historial muestra el nombre del site de una excepción, no su id", async ({ page, request }) => {
    const admin = await AdminApi.login(request)
    const [site] = await admin.pickupSites()
    test.skip(!site, "No hay sites de retiro configurados")
    const fecha = await admin.freeDate(60)
    const motivo = `E2E historial ${Date.now()}`
    cleanupExceptions(fecha, motivo)
    await admin.createException({ fecha, stock_location_id: site.id, tipo: "cerrado", motivo })

    await page.goto(AGENDA)
    await page.getByRole("tab", { name: "Historial" }).click()
    const cambio = page.getByRole("row").filter({ hasText: motivo }).first()
    await expect(cambio).toBeVisible({ timeout: 15_000 })
    await expect(cambio).toContainText(`Site: ${site.name}`)
    await expect(cambio).not.toContainText("sloc_")
})
