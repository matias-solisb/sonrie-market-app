import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { LoginPage } from "./pages/login-page"
import { RecoverPasswordPage } from "./pages/recover-password-page"
import { ResetPasswordPage } from "./pages/reset-password-page"
import { AdminApi, hasAdmin } from "./utils/admin-api"

/*
Recuperación de contraseña en dos pasos (rut-auth, paso 8):
  1. /cl/recover-password  → requestPasswordReset (lib/data/customer.ts), con RUT
  2. /cl/reset-password?token=...  → resetPassword (lib/data/customer.ts)

El enlace lo arma backend/src/subscribers/customer-password-reset.ts. Mientras
no haya correo real (provider "local"), en desarrollo sale destacado en la
consola del backend y queda en la notificación (GET /admin/notifications), que
es de donde lo lee el flujo completo del final.

Variables en .env.e2e:
- E2E_USER_RUT                    → solicitud con un RUT existente
- E2E_RESET_RUT / E2E_RESET_EMAIL / E2E_RESET_PASSWORD → usuario DEDICADO al
  flujo completo (se le cambia la clave y al final se le restaura)
- E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD → para leer el enlace desde el Admin
*/

const USER_RUT = process.env.E2E_USER_RUT
const RESET_RUT = process.env.E2E_RESET_RUT
const RESET_EMAIL = process.env.E2E_RESET_EMAIL
const RESET_PASSWORD = process.env.E2E_RESET_PASSWORD

const MSG = {
    rutRequired: "El RUT es requerido",
    rutInvalid: "El RUT no es válido",
    newPasswordRequired: "La Contraseña nueva es requerida",
    repeatRequired: "La Contraseña es requerida",
    tooShort: "Debe tener al menos 8 caracteres",
    mismatch: "Las contraseñas no coinciden",
    invalidToken: "El link expiró o no es válido",
    derivedFromRut: "La clave no puede contener números de tu RUT.",
}

/** Token con la forma de un JWT (sin firma válida) cuyo entity_id es `rut`. */
function fakeResetToken(rut: string) {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
    return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ entity_id: rut, purpose: "reset" })}.firma-invalida`
}

/** Cuenta las llamadas a server actions (POST con header `next-action`). */
function trackServerActions(page: Page) {
    const calls: string[] = []
    page.on("request", (req) => {
        if (req.method() === "POST" && req.headers()["next-action"]) {
            calls.push(req.url())
        }
    })
    return calls
}

// ─────────────────────────────────────────────────────────────
// Paso 1: solicitar el correo de recuperación
// ─────────────────────────────────────────────────────────────
test.describe("solicitar recuperación", () => {
    let recover: RecoverPasswordPage

    test.beforeEach(async ({ page }) => {
        recover = new RecoverPasswordPage(page)
        await recover.goto()
    })

    test("RUT vacío muestra error y no envía", async ({ page }) => {
        const calls = trackServerActions(page)

        await recover.submit.click()

        await expect(recover.fieldError(MSG.rutRequired)).toBeVisible()
        await expect(recover.rut).toHaveAttribute("aria-invalid", "true")
        expect(calls).toHaveLength(0)
    })

    for (const rut of ["12.345.678-4", "matias@quantor.cl", "12345", "12.3a5.678-5"]) {
        test(`RUT inválido "${rut}" muestra error y no envía`, async ({ page }) => {
            const calls = trackServerActions(page)

            await recover.request(rut)

            await expect(recover.fieldError(MSG.rutInvalid)).toBeVisible()
            expect(calls).toHaveLength(0)
        })
    }

    test("RUT existente muestra el mensaje de confirmación", async () => {
        test.skip(!USER_RUT, "Falta E2E_USER_RUT en .env.e2e")

        // Solo genera un enlace: la clave del usuario de prueba no cambia.
        await recover.request(USER_RUT!)

        await expect(recover.successMessage()).toBeVisible()
        await expect(recover.rut).toBeHidden() // el formulario se reemplaza
    })

    test("RUT inexistente muestra el MISMO mensaje (sin enumeración)", async () => {
        await recover.request("12.345.678-5")

        await expect(recover.successMessage()).toBeVisible()
        await expect(recover.serverError).toBeHidden()
    })

    test("Volver al Login lleva al login", async ({ page }) => {
        await recover.backToLogin.click()

        await expect(page).toHaveURL(/\/cl\/account/, { timeout: 30_000 })
        await expect(page.getByTestId("login-page")).toBeVisible()
    })
})

// ─────────────────────────────────────────────────────────────
// Paso 2: definir la contraseña nueva desde el link del correo
// ─────────────────────────────────────────────────────────────
test.describe("definir contraseña nueva", () => {
    let reset: ResetPasswordPage

    test("sin token muestra Link no válido y no hay formulario", async ({ page }) => {
        reset = new ResetPasswordPage(page)
        await reset.goto()

        await expect(reset.title("Link no válido")).toBeVisible()
        await expect(reset.password).toBeHidden()
        await expect(reset.backToLogin).toBeVisible()
    })

    test.describe("con token (validaciones del formulario)", () => {
        // Token inventado: sirve para probar el formulario, porque la validación
        // de zod corre antes de llamar al servidor.
        test.beforeEach(async ({ page }) => {
            reset = new ResetPasswordPage(page)
            await reset.goto("token-de-prueba")
            await expect(reset.title("Nueva contraseña")).toBeVisible()
        })

        test("ambos campos vacíos muestran error y no envía", async ({ page }) => {
            const calls = trackServerActions(page)

            await reset.submit.click()

            await expect(reset.fieldError(MSG.newPasswordRequired)).toBeVisible()
            await expect(reset.fieldError(MSG.repeatRequired)).toBeVisible()
            expect(calls).toHaveLength(0)
        })

        test("contraseña de menos de 8 caracteres", async ({ page }) => {
            const calls = trackServerActions(page)

            await reset.setPassword("Abc1234") // 7 caracteres

            await expect(reset.fieldError(MSG.tooShort)).toBeVisible()
            expect(calls).toHaveLength(0)
        })

        test("las contraseñas no coinciden", async ({ page }) => {
            const calls = trackServerActions(page)

            await reset.setPassword("NuevaClave123", "NuevaClave124")

            await expect(reset.fieldError(MSG.mismatch)).toBeVisible()
            expect(calls).toHaveLength(0)
        })

        test("falta repetir la contraseña", async () => {
            await reset.setPassword("NuevaClave123", "")

            await expect(reset.fieldError(MSG.repeatRequired)).toBeVisible()
        })

        test("una clave con números del RUT se rechaza ANTES de gastar el enlace", async ({ page }) => {
            // El RUT sale del token: 12.345.678-5 → no puede contener 5678, 1234…
            await reset.goto(fakeResetToken("12345678-5"))
            await expect(reset.title("Nueva contraseña")).toBeVisible()
            const calls = trackServerActions(page)

            await reset.setPassword("Soprole-5678")

            await expect(reset.serverError).toContainText(MSG.derivedFromRut)
            // El server action corre, pero no llega a llamar al backend: el
            // token (real) seguiría sirviendo.
            expect(calls.length).toBeGreaterThan(0)
        })

        test("token inválido o vencido: el servidor lo rechaza", async () => {
            await reset.setPassword("NuevaClave123")

            await expect(reset.serverError).toContainText(MSG.invalidToken)
            // Se queda en el formulario; no aparece "Contraseña actualizada"
            await expect(reset.title("Contraseña actualizada")).toBeHidden()
        })
    })
})

// ─────────────────────────────────────────────────────────────
// Flujo completo con el enlace real (lo lee desde GET /admin/notifications)
// ─────────────────────────────────────────────────────────────
test.describe("flujo completo", () => {
    test.skip(
        !RESET_RUT || !RESET_EMAIL || !RESET_PASSWORD || !hasAdmin,
        "Define E2E_RESET_RUT, E2E_RESET_EMAIL, E2E_RESET_PASSWORD y E2E_ADMIN_* en .env.e2e"
    )
    test.use({ storageState: { cookies: [], origins: [] } })
    test.describe.configure({ timeout: 120_000 })

    /** Pide el reset por la UI y devuelve el enlace de la notificación nueva. */
    async function pedirEnlace(page: Page, request: APIRequestContext) {
        const admin = await AdminApi.login(request)
        const antes = new Set(
            (await admin.get(`/admin/notifications?to=${encodeURIComponent(RESET_EMAIL!)}&limit=50`))
                .notifications.map((n: any) => n.id)
        )

        const recover = new RecoverPasswordPage(page)
        await recover.goto()
        await recover.request(RESET_RUT!)
        await expect(recover.successMessage()).toBeVisible({ timeout: 30_000 })

        // El subscriber corre después de responder: se espera la notificación.
        let url: string | undefined
        await expect
            .poll(async () => {
                const { notifications } = await admin.get(
                    `/admin/notifications?to=${encodeURIComponent(RESET_EMAIL!)}&limit=50`
                )
                url = notifications.find(
                    (n: any) => !antes.has(n.id) && n.template === "password-reset"
                )?.data?.reset_url
                return Boolean(url)
            }, { timeout: 15_000 })
            .toBe(true)

        // Mismo host que usa el test (el backend arma el enlace con STOREFRONT_URL)
        const parsed = new URL(url!)
        return `${parsed.pathname}${parsed.search}`
    }

    async function definirClave(page: Page, path: string, password: string) {
        await page.goto(path)
        const reset = new ResetPasswordPage(page)
        await reset.setPassword(password)
        return reset
    }

    test("pedir reset → abrir enlace → cambiar clave → entrar con la nueva; el enlace no se reusa", async ({ page, request, browser }) => {
        const nueva = `${RESET_PASSWORD}-reset`
        let changed = false

        try {
            const path = await pedirEnlace(page, request)

            const reset = await definirClave(page, path, nueva)
            await expect(reset.title("Contraseña actualizada")).toBeVisible({ timeout: 30_000 })
            changed = true

            // La anterior ya no sirve, la nueva sí
            const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
            const login = new LoginPage(await ctx.newPage())
            await login.goto()
            await login.login(RESET_RUT!, RESET_PASSWORD!)
            await expect(login.serverError).toBeVisible({ timeout: 30_000 })
            await login.goto()
            await login.login(RESET_RUT!, nueva)
            await expect(login.page.getByTestId("overview-page-wrapper")).toBeVisible({ timeout: 30_000 })
            await ctx.close()

            // El mismo enlace no se puede usar dos veces
            const again = await definirClave(page, path, `${nueva}-otra`)
            await expect(again.serverError).toContainText(MSG.invalidToken, { timeout: 30_000 })
        } finally {
            // Restaurar la clave original para la próxima ejecución
            if (changed) {
                const path = await pedirEnlace(page, request)
                const reset = await definirClave(page, path, RESET_PASSWORD!)
                await expect(reset.title("Contraseña actualizada")).toBeVisible({ timeout: 30_000 })
            }
        }
    })
})
