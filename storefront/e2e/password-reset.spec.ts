import { expect, test, type Page } from "@playwright/test"
import { RecoverPasswordPage } from "./pages/recover-password-page"
import { ResetPasswordPage } from "./pages/reset-password-page"

/*
Restauración de contraseña en dos pasos:
  1. /cl/recover-password  → requestPasswordReset (lib/data/customer.ts)
  2. /cl/reset-password?token=...  → resetPassword (lib/data/customer.ts)

El link con el token lo arma backend/src/subscribers/customer-password-reset.ts
y hoy solo se escribe en la consola del backend (provider de notificaciones
"local"). Por eso el flujo completo con un token real queda como fixme al
final: necesita un buzón de pruebas (Mailpit) para que el test lea el correo.
*/

const USER_EMAIL = process.env.E2E_USER_EMAIL

const MSG = {
    emailRequired: "El Correo es requerido",
    emailInvalid: "Debe ser un email válido",
    newPasswordRequired: "La Contraseña nueva es requerida",
    repeatRequired: "La Contraseña es requerida",
    tooShort: "Debe tener al menos 8 caracteres",
    mismatch: "Las contraseñas no coinciden",
    invalidToken: "El link expiró o no es válido",
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

    test("correo vacío muestra error y no envía", async ({ page }) => {
        const calls = trackServerActions(page)

        await recover.submit.click()

        await expect(recover.fieldError(MSG.emailRequired)).toBeVisible()
        await expect(recover.email).toHaveAttribute("aria-invalid", "true")
        expect(calls).toHaveLength(0)
    })

    for (const email of ["matias", "matias@", "@quantor.cl", "matias@quantor"]) {
        test(`correo mal escrito "${email}" muestra error y no envía`, async ({ page }) => {
            const calls = trackServerActions(page)

            await recover.request(email)

            await expect(recover.fieldError(MSG.emailInvalid)).toBeVisible()
            expect(calls).toHaveLength(0)
        })
    }

    test("correo existente muestra el mensaje de confirmación", async () => {
        test.skip(!USER_EMAIL, "Falta E2E_USER_EMAIL en .env.e2e")

        // Solo genera un token: la clave del usuario de prueba no cambia.
        await recover.request(USER_EMAIL!)

        await expect(recover.successMessage()).toBeVisible()
        await expect(recover.email).toBeHidden() // el formulario se reemplaza
    })

    test("correo inexistente muestra el MISMO mensaje (sin enumeración)", async () => {
        await recover.request("noexiste@sonriemarket.cl")

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

        test("token inválido o vencido: el servidor lo rechaza", async () => {
            await reset.setPassword("NuevaClave123")

            await expect(reset.serverError).toContainText(MSG.invalidToken)
            // Se queda en el formulario; no aparece "Contraseña actualizada"
            await expect(reset.title("Contraseña actualizada")).toBeHidden()
        })
    })
})

// ─────────────────────────────────────────────────────────────
// Flujo completo con token real (pendiente)
// ─────────────────────────────────────────────────────────────
test.describe("flujo completo (requiere buzón de pruebas)", () => {
    /*
    Pasos cuando haya Mailpit (o similar) en dev:
      1. Pedir la recuperación para un usuario DEDICADO a este test
         (no customer01: se le cambia la clave).
      2. Leer el correo desde la API de Mailpit (GET http://localhost:8025/api/v1/messages)
         y extraer el reset_url.
      3. page.goto(reset_url) → setPassword(clave nueva) → "Contraseña actualizada".
      4. Login con la clave nueva funciona; con la anterior, no.
      5. Reusar el mismo link → "El link expiró o no es válido" (token de un solo uso).
    */
    test.fixme("pedir reset → abrir link → cambiar clave → entrar con la nueva", async () => { })
    test.fixme("la clave anterior deja de funcionar", async () => { })
    test.fixme("el link no se puede usar dos veces", async () => { })
})
