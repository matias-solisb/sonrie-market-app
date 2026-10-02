import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { createHmac } from "node:crypto"
import { LoginPage } from "./pages/login-page"

/*
Cuenta y sesión:
  1. Cerrar sesión (menú del header y menú de "Mi cuenta").
  2. Cambio de contraseña desde "Mis Datos" (ProfileCard → changePassword →
     POST /store/customers/me/password).
  3. Cookie de sesión (_medusa_jwt) adulterada o vencida.

Cada test inicia su propia sesión (no usa el storageState compartido) para no
afectar a los demás specs.

Variables en .env.e2e:
- E2E_USER_EMAIL / E2E_USER_PASSWORD      → logout, cookies y validaciones
- E2E_PWD_USER_EMAIL / E2E_PWD_USER_PASSWORD → usuario DEDICADO al cambio de
  clave (el test le cambia la clave y al final se la restaura)
- E2E_JWT_SECRET (opcional) → el JWT_SECRET del backend de DEV, para firmar un
  token vencido de verdad. NUNCA el de otro ambiente.
*/

const USER_EMAIL = process.env.E2E_USER_EMAIL
const USER_PASSWORD = process.env.E2E_USER_PASSWORD
const PWD_USER_EMAIL = process.env.E2E_PWD_USER_EMAIL
const PWD_USER_PASSWORD = process.env.E2E_PWD_USER_PASSWORD
const JWT_SECRET = process.env.E2E_JWT_SECRET

const AUTH_COOKIE = "_medusa_jwt"

test.use({ storageState: { cookies: [], origins: [] } })
test.describe.configure({ timeout: 120_000 })

// ─── helpers ────────────────────────────────────────────────
async function loginAs(page: Page, email: string, password: string) {
    const login = new LoginPage(page)
    await login.goto()
    await login.login(email, password)
    await expect(page.getByTestId("overview-page-wrapper")).toBeVisible({ timeout: 30_000 })
}

async function authCookie(context: BrowserContext) {
    return (await context.cookies()).find((c) => c.name === AUTH_COOKIE)
}

async function setAuthCookie(context: BrowserContext, value: string) {
    await context.addCookies([{ name: AUTH_COOKIE, value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Strict" }])
}

/** Firma un JWT HS256 (solo para el test del token vencido). */
function signJwt(payload: Record<string, unknown>, secret: string) {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
    const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`
    const sig = createHmac("sha256", secret).update(body).digest("base64url")
    return `${body}.${sig}`
}

function decodePayload(token: string): Record<string, unknown> {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
}

/** La página no debe mostrar un error de Next ni responder 5xx. */
async function expectNoCrash(page: Page, status: number | undefined) {
    expect(status ?? 200, "La página respondió con error de servidor").toBeLessThan(500)
    await expect(page.getByText(/Application error|Internal Server Error|Unhandled Runtime Error/i)).toHaveCount(0)
}

// ─────────────────────────────────────────────────────────────
// 1. Cerrar sesión
// ─────────────────────────────────────────────────────────────
test.describe("cerrar sesión", () => {
    test.skip(!USER_EMAIL || !USER_PASSWORD, "Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.e2e")

    test("desde el menú del header borra la cookie y vuelve al login", async ({ page, context }) => {
        await loginAs(page, USER_EMAIL!, USER_PASSWORD!)
        expect(await authCookie(context)).toBeDefined()

        await page.getByTestId("nav-account-menu-button").click()
        await page.getByTestId("nav-account-menu-logout").click()

        await expect(page).toHaveURL(/\/cl\/account$/, { timeout: 30_000 })
        await expect(page.getByTestId("login-page")).toBeVisible()
        expect(await authCookie(context)).toBeUndefined()
    })

    test('después de cerrar sesión, "Atrás" no vuelve a mostrar datos de la cuenta', async ({ page }) => {
        await loginAs(page, USER_EMAIL!, USER_PASSWORD!)
        await page.goto("/cl/account/profile")
        await expect(page.getByText(USER_EMAIL!).first()).toBeVisible({ timeout: 30_000 })

        await page.getByTestId("nav-account-menu-button").click()
        await page.getByTestId("nav-account-menu-logout").click()
        await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 30_000 })

        await page.goBack()
        await page.waitForLoadState("load")

        // Puede volver al login o a una página sin datos, pero nunca al perfil con el correo.
        await expect(page.getByText(USER_EMAIL!)).toHaveCount(0, { timeout: 10_000 })
    })

    test("después de cerrar sesión, las rutas protegidas piden login", async ({ page }) => {
        await loginAs(page, USER_EMAIL!, USER_PASSWORD!)
        await page.getByTestId("nav-account-menu-button").click()
        await page.getByTestId("nav-account-menu-logout").click()
        await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 30_000 })

        for (const path of ["/cl/store", "/cl/cart"]) {
            await page.goto(path)
            await expect(page).toHaveURL(/\/cl\/account\?redirect_to=/, { timeout: 30_000 })
        }
    })

    // Medusa usa JWT sin estado: cerrar sesión borra la cookie, pero el token
    // podría seguir siendo válido hasta que expire. Si este test falla, un token
    // copiado (por ejemplo, desde un computador compartido de planta) sigue
    // sirviendo después del logout. Es un hallazgo de seguridad para revisar,
    // no un error del test.
    test.fixme("el token anterior deja de servir después de cerrar sesión", async ({ page, context }) => {
        await loginAs(page, USER_EMAIL!, USER_PASSWORD!)
        const oldToken = (await authCookie(context))!.value

        await page.getByTestId("nav-account-menu-button").click()
        await page.getByTestId("nav-account-menu-logout").click()
        await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 30_000 })

        await setAuthCookie(context, oldToken)
        await page.goto("/cl/account")

        await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId("overview-page-wrapper")).toHaveCount(0)
    })
})

// ─────────────────────────────────────────────────────────────
// 2. Cambio de contraseña desde "Mis Datos"
// ─────────────────────────────────────────────────────────────
const MSG = {
    wrongCurrent: "La contraseña actual no es correcta.",
    success: "Contraseña actualizada correctamente",
    tooShort: "Debe tener al menos 8 caracteres",
    mismatch: "Las contraseñas no coinciden",
    badCredentials: "Usuario y contraseña no coinciden",
}

async function openPasswordForm(page: Page) {
    await page.goto("/cl/account/profile")
    await page.getByRole("button", { name: "Cambiar contraseña" }).click()
    await expect(page.getByLabel("Contraseña actual", { exact: true })).toBeVisible({ timeout: 30_000 })
}

async function fillPasswordForm(page: Page, current: string, next: string, repeat = next) {
    await page.getByLabel("Contraseña actual", { exact: true }).fill(current)
    await page.getByLabel("Ingresar nueva contraseña", { exact: true }).fill(next)
    await page.getByLabel("Repetir contraseña", { exact: true }).fill(repeat)
    await page.getByRole("button", { name: "Guardar contraseña" }).click()
}

/** Cambia la clave por la UI en un contexto nuevo (para el cambio y la restauración). */
async function changePasswordViaUi(page: Page, email: string, current: string, next: string) {
    await loginAs(page, email, current)
    await openPasswordForm(page)
    await fillPasswordForm(page, current, next)
    await expect(page.getByText(MSG.success).first()).toBeVisible({ timeout: 30_000 })
}

test.describe("cambio de contraseña", () => {
    test.describe("validaciones (sin cambiar la clave)", () => {
        test.skip(!USER_EMAIL || !USER_PASSWORD, "Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.e2e")

        test.beforeEach(async ({ page }) => {
            await loginAs(page, USER_EMAIL!, USER_PASSWORD!)
            await openPasswordForm(page)
        })

        test("con la contraseña actual incorrecta falla y no cambia nada", async ({ page }) => {
            await fillPasswordForm(page, "ClaveIncorrecta123", "NuevaClave123")

            await expect(page.getByText(MSG.wrongCurrent).first()).toBeVisible({ timeout: 30_000 })
            await expect(page.getByText(MSG.success)).toHaveCount(0)
            // El formulario sigue abierto para corregir
            await expect(page.getByLabel("Contraseña actual", { exact: true })).toBeVisible()
        })

        test("una clave nueva de menos de 8 caracteres se rechaza", async ({ page }) => {
            await fillPasswordForm(page, USER_PASSWORD!, "Abc1234")

            await expect(page.getByText(MSG.tooShort).first()).toBeVisible()
            await expect(page.getByText(MSG.success)).toHaveCount(0)
        })

        test("si la repetición no coincide se rechaza", async ({ page }) => {
            await fillPasswordForm(page, USER_PASSWORD!, "NuevaClave123", "NuevaClave124")

            await expect(page.getByText(MSG.mismatch).first()).toBeVisible()
            await expect(page.getByText(MSG.success)).toHaveCount(0)
        })
    })

    test.describe("cambio real (usuario dedicado)", () => {
        test.skip(!PWD_USER_EMAIL || !PWD_USER_PASSWORD, "Define E2E_PWD_USER_EMAIL y E2E_PWD_USER_PASSWORD en .env.e2e")

        test("después del cambio, la clave anterior deja de servir y la nueva funciona", async ({ browser }) => {
            const original = PWD_USER_PASSWORD!
            const next = `${original}-e2e`
            let changed = false

            try {
                // 1. Cambiar la clave
                const ctx1 = await browser.newContext()
                await changePasswordViaUi(await ctx1.newPage(), PWD_USER_EMAIL!, original, next)
                changed = true
                await ctx1.close()

                // 2. La anterior ya no sirve
                const ctx2 = await browser.newContext()
                const page2 = await ctx2.newPage()
                const login = new LoginPage(page2)
                await login.goto()
                await login.login(PWD_USER_EMAIL!, original)
                await expect(login.serverError).toHaveText(MSG.badCredentials, { timeout: 30_000 })
                await ctx2.close()

                // 3. La nueva sí
                const ctx3 = await browser.newContext()
                await loginAs(await ctx3.newPage(), PWD_USER_EMAIL!, next)
                await ctx3.close()
            } finally {
                // 4. Restaurar la clave original para la próxima ejecución
                if (changed) {
                    const ctx = await browser.newContext()
                    await changePasswordViaUi(await ctx.newPage(), PWD_USER_EMAIL!, next, original)
                    await ctx.close()
                }
            }
        })
    })
})

// ─────────────────────────────────────────────────────────────
// 3. Cookie de sesión adulterada o vencida
// ─────────────────────────────────────────────────────────────
// El middleware solo revisa que la cookie EXISTA (no la valida). Lo esperado
// es que con un token inválido la tienda trate al usuario como no logueado:
// sin error de servidor y pidiendo login, no mostrando el catálogo.
test.describe("cookie de sesión inválida", () => {
    test("una cookie con basura no rompe la página y pide login", async ({ page, context }) => {
        await setAuthCookie(context, "esto-no-es-un-jwt")

        const response = await page.goto("/cl/account")

        await expectNoCrash(page, response?.status())
        await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 30_000 })
    })

    test("con una cookie con basura no se puede ver el catálogo", async ({ page, context }) => {
        await setAuthCookie(context, "esto-no-es-un-jwt")

        const response = await page.goto("/cl/store")

        await expectNoCrash(page, response?.status())
        await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId("product-wrapper")).toHaveCount(0)
    })

    test("un token con el contenido adulterado (firma inválida) no da acceso", async ({ page, context }) => {
        test.skip(!USER_EMAIL || !USER_PASSWORD, "Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.e2e")
        await loginAs(page, USER_EMAIL!, USER_PASSWORD!)
        const token = (await authCookie(context))!.value

        // Cambia el payload sin volver a firmar: la firma deja de calzar.
        const [header, , signature] = token.split(".")
        const payload = { ...decodePayload(token), actor_id: "cus_adulterado" }
        const tampered = `${header}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`
        await setAuthCookie(context, tampered)

        const response = await page.goto("/cl/account")

        await expectNoCrash(page, response?.status())
        await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 30_000 })
    })

    test("un token vencido (bien firmado) no da acceso", async ({ page, context }) => {
        test.skip(!JWT_SECRET, "Define E2E_JWT_SECRET (JWT_SECRET del backend de DEV) en .env.e2e")
        test.skip(!USER_EMAIL || !USER_PASSWORD, "Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.e2e")
        await loginAs(page, USER_EMAIL!, USER_PASSWORD!)
        const token = (await authCookie(context))!.value

        const now = Math.floor(Date.now() / 1000)
        const expired = signJwt({ ...decodePayload(token), iat: now - 7200, exp: now - 3600 }, JWT_SECRET!)
        await setAuthCookie(context, expired)

        const response = await page.goto("/cl/account")

        await expectNoCrash(page, response?.status())
        await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 30_000 })
    })
})
