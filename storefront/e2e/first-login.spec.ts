import { expect, test, type Page } from "@playwright/test"
import { LoginPage } from "./pages/login-page"

/*
Primer ingreso: cambio de clave obligatorio (rut-auth, pasos 5 y 6).

Necesita un colaborador RECIÉN CREADO, que todavía tenga la clave inicial
(últimos 4 dígitos del RUT antes del DV). Se crea con el script de alta del
backend (docs/manual-usuarios.md, sección 5):

  npx medusa exec ./src/scripts/alta-colaborador.ts <rut> <correo> <nombre> "<apellido>"

y se define en .env.e2e:

  E2E_FIRST_LOGIN_RUT=<rut>

⚠️ El último test le cambia la clave, así que el usuario sirve UNA sola
ejecución. Para repetir, da de alta otro RUT (o restablécele la clave
inicial) y actualiza la variable.
*/

const RUT = process.env.E2E_FIRST_LOGIN_RUT
const NUEVA = "Primer-Ingreso-Sonrie"

const MSG = {
    wrongCurrent: "La clave actual no es correcta.",
    derivedFromRut: "La clave no puede contener números de tu RUT.",
    mismatch: "Las contraseñas no coinciden",
}

const claveInicial = (rut: string) =>
    rut.replace(/[.\s]/g, "").split("-")[0].slice(-4)

test.use({ storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: "serial", timeout: 120_000 })

test.skip(!RUT, "Define E2E_FIRST_LOGIN_RUT (colaborador recién creado) en .env.e2e")

async function loginInicial(page: Page) {
    const login = new LoginPage(page)
    await login.goto()
    await login.login(RUT!, claveInicial(RUT!))
    await expect(page).toHaveURL(/\/cl\/cambiar-clave/, { timeout: 30_000 })
    await expect(page.getByTestId("forced-password-change-page")).toBeVisible()
}

async function fill(page: Page, current: string, next: string, repeat = next) {
    await page.getByTestId("current-password-input").fill(current)
    await page.getByTestId("password-input").fill(next)
    await page.getByTestId("repeat-password-input").fill(repeat)
    await page.getByTestId("forced-password-change-submit").click()
}

test("con la clave inicial, el login lleva a cambiar la clave", async ({ page }) => {
    await loginInicial(page)
})

test("sin cambiar la clave no se puede entrar a la tienda", async ({ page }) => {
    await loginInicial(page)

    for (const path of ["/cl", "/cl/store", "/cl/account", "/cl/cart"]) {
        await page.goto(path)
        await expect(page).toHaveURL(/\/cl\/cambiar-clave/, { timeout: 30_000 })
    }
})

test("errores del formulario", async ({ page }) => {
    await loginInicial(page)

    await fill(page, "0000", NUEVA)
    await expect(page.getByText(MSG.wrongCurrent)).toBeVisible({ timeout: 30_000 })

    await fill(page, claveInicial(RUT!), `Soprole-${claveInicial(RUT!)}`)
    await expect(page.getByText(MSG.derivedFromRut)).toBeVisible({ timeout: 30_000 })

    await fill(page, claveInicial(RUT!), NUEVA, `${NUEVA}x`)
    await expect(page.getByText(MSG.mismatch)).toBeVisible()

    // Sigue pendiente
    await page.goto("/cl/store")
    await expect(page).toHaveURL(/\/cl\/cambiar-clave/, { timeout: 30_000 })
})

test("después de cambiarla entra a la tienda, y con la clave nueva ya no se le pide", async ({ page, browser }) => {
    await loginInicial(page)

    await fill(page, claveInicial(RUT!), NUEVA)
    await expect(page).not.toHaveURL(/cambiar-clave/, { timeout: 30_000 })

    // Otra sesión, con la clave nueva: directo a la cuenta
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page2 = await ctx.newPage()
    const login = new LoginPage(page2)
    await login.goto()
    await login.login(RUT!, NUEVA)
    await expect(page2.getByTestId("overview-page-wrapper")).toBeVisible({ timeout: 30_000 })
    await ctx.close()
})
