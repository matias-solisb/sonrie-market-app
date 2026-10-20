import { expect, test } from "@playwright/test"
import { LoginPage } from "./pages/login-page"
import { AdminApi, hasAdmin } from "./utils/admin-api"

/*
Colaborador deshabilitado (rut-auth, paso 9).

Usa un colaborador DEDICADO, con la clave inicial ya cambiada:
  E2E_DISABLED_RUT / E2E_DISABLED_EMAIL / E2E_DISABLED_PASSWORD
y un admin (E2E_ADMIN_*) para deshabilitarlo por la API del Admin, igual que
el widget "Acceso a la tienda". Al final se vuelve a habilitar.
*/

const RUT = process.env.E2E_DISABLED_RUT
const EMAIL = process.env.E2E_DISABLED_EMAIL
const PASSWORD = process.env.E2E_DISABLED_PASSWORD

const MSG = {
    disabled: "Tu cuenta está deshabilitada. Contacta a tu administrador.",
    badCredentials:
        "RUT o clave incorrectos. Después de 5 intentos fallidos, la cuenta se bloquea por 15 minutos.",
    sessionClosed: "Tu sesión se cerró",
}

test.use({ storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: "serial", timeout: 120_000 })

test.skip(
    !RUT || !EMAIL || !PASSWORD || !hasAdmin,
    "Define E2E_DISABLED_RUT, E2E_DISABLED_EMAIL, E2E_DISABLED_PASSWORD y E2E_ADMIN_* en .env.e2e"
)

async function customerId(admin: AdminApi) {
    const { customers } = await admin.get(`/admin/customers?q=${encodeURIComponent(EMAIL!)}`)
    const customer = customers.find((c: any) => c.email === EMAIL)
    expect(customer, `No hay un cliente con correo ${EMAIL}`).toBeTruthy()
    return customer.id as string
}

async function setEnabled(admin: AdminApi, enabled: boolean) {
    await admin.post(`/admin/colaboradores/${await customerId(admin)}/habilitacion`, { enabled })
}

test.afterAll(async ({ request }) => {
    await setEnabled(await AdminApi.login(request), true)
})

test("con la sesión abierta, al deshabilitarlo se cierra la sesión y ve el aviso", async ({ page, context, request }) => {
    const admin = await AdminApi.login(request)
    await setEnabled(admin, true)

    const login = new LoginPage(page)
    await login.goto()
    await login.login(RUT!, PASSWORD!)
    await expect(page.getByTestId("overview-page-wrapper")).toBeVisible({ timeout: 30_000 })

    await setEnabled(admin, false)

    await page.goto("/cl/store")

    await expect(page).toHaveURL(/\/cl\/account\?sesion=cerrada/, { timeout: 30_000 })
    await expect(page.getByTestId("session-closed-message")).toContainText(MSG.sessionClosed)
    await expect(page.getByTestId("login-page")).toBeVisible()
    expect((await context.cookies()).find((c) => c.name === "_medusa_jwt")).toBeUndefined()
})

test("deshabilitado: con la clave correcta ve el aviso; con una incorrecta, el mensaje genérico", async ({ page, request }) => {
    await setEnabled(await AdminApi.login(request), false)
    const login = new LoginPage(page)
    await login.goto()

    await login.login(RUT!, PASSWORD!)
    await expect(login.serverError).toHaveText(MSG.disabled, { timeout: 30_000 })
    await expect(page.getByTestId("overview-page-wrapper")).toHaveCount(0)
    await login.serverError.getByRole("button", { name: /close|cerrar/i }).click()

    await login.login(RUT!, "ClaveEquivocada123")
    await expect(login.serverError).toHaveText(MSG.badCredentials, { timeout: 30_000 })
})

test("habilitado de nuevo, entra con la misma clave", async ({ page, request }) => {
    await setEnabled(await AdminApi.login(request), true)

    const login = new LoginPage(page)
    await login.goto()
    await login.login(RUT!, PASSWORD!)

    await expect(page.getByTestId("overview-page-wrapper")).toBeVisible({ timeout: 30_000 })
})
