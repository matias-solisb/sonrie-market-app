import { expect, test, type Page } from "@playwright/test"
import { LoginPage } from "./pages/login-page"

const USER_RUT = process.env.E2E_USER_RUT
const USER_PASSWORD = process.env.E2E_USER_PASSWORD

// RUT con DV correcto que no existe en la base de prueba (12.345.678-5).
const RUT_INEXISTENTE = "12.345.678-5"

const MSG = {
    rutRequired: "El RUT es requerido",
    rutInvalid: "El RUT no es válido",
    passwordRequired: "La Contraseña es requerida",
    badCredentials:
        "RUT o clave incorrectos. Después de 5 intentos fallidos, la cuenta se bloquea por 15 minutos.",
}

/**
 * Cuenta las llamadas al server action. Next manda los server actions como
 * POST con el header `next-action`. Sirve para probar que la validación del
 * cliente corta el envío.
 */
function trackServerActions(page: Page) {
    const calls: string[] = []
    page.on("request", (req) => {
        if (req.method() === "POST" && req.headers()["next-action"]) {
            calls.push(req.url())
        }
    })
    return calls
}

let login: LoginPage

test.beforeEach(async ({ page }) => {
    login = new LoginPage(page)
    await login.goto()
})

// ─────────────────────────────────────────────────────────────
// 6.1 Campos vacíos
// ─────────────────────────────────────────────────────────────
test.describe("campos vacíos", () => {
    test("ambos vacíos muestra los dos errores y no envía", async ({ page }) => {
        const calls = trackServerActions(page)

        await login.submit.click()

        await expect(login.fieldError(MSG.rutRequired)).toBeVisible()
        await expect(login.fieldError(MSG.passwordRequired)).toBeVisible()
        await expect(login.rut).toHaveAttribute("aria-invalid", "true")
        await expect(login.password).toHaveAttribute("aria-invalid", "true")
        expect(calls).toHaveLength(0)
    })

    test("solo RUT vacío", async () => {
        await login.password.fill("cualquiera")
        await login.submit.click()

        await expect(login.fieldError(MSG.rutRequired)).toBeVisible()
        await expect(login.fieldError(MSG.passwordRequired)).toBeHidden()
    })

    test("solo contraseña vacía", async () => {
        await login.rut.fill(RUT_INEXISTENTE)
        await login.submit.click()

        await expect(login.fieldError(MSG.passwordRequired)).toBeVisible()
        await expect(login.fieldError(MSG.rutRequired)).toBeHidden()
    })

    test("RUT con solo espacios cuenta como vacío", async () => {
        await login.rut.fill("     ")
        await login.password.fill("cualquiera")
        await login.submit.click()

        await expect(login.fieldError(MSG.rutRequired)).toBeVisible()
    })

    test("el error desaparece al escribir (revalidación onChange)", async () => {
        await login.submit.click()
        await expect(login.fieldError(MSG.rutRequired)).toBeVisible()

        await login.rut.fill(RUT_INEXISTENTE)

        await expect(login.fieldError(MSG.rutRequired)).toBeHidden()
        await expect(login.rut).toHaveAttribute("aria-invalid", "false")
    })
})

// ─────────────────────────────────────────────────────────────
// 6.2 RUT mal escrito: el dígito verificador se valida en el cliente
// ─────────────────────────────────────────────────────────────
test.describe("RUT con formato o DV inválido", () => {
    const invalidRuts = [
        "12.345.678-4",   // DV incorrecto
        "10.000.013-0",   // DV 0 donde corresponde K
        "12.345.678-X",   // DV con letra que no es K
        "12a45678-5",     // letra en el cuerpo
        "99999-9",        // cuerpo demasiado corto
        "123456789-2",    // cuerpo de 9 dígitos
        "matias@quantor.cl", // un correo (el login anterior)
    ]

    for (const rut of invalidRuts) {
        test(`rechaza "${rut}" sin enviar`, async ({ page }) => {
            const calls = trackServerActions(page)

            await login.login(rut, "cualquiera")

            await expect(login.fieldError(MSG.rutInvalid)).toBeVisible()
            expect(calls).toHaveLength(0)
        })
    }

    for (const rut of ["12345678-5", "123456785", " 12.345.678-5 ", "10.000.013-k"]) {
        test(`acepta el formato "${rut}" y lo manda al servidor`, async ({ page }) => {
            const calls = trackServerActions(page)

            await login.login(rut, "Incorrecta123")

            await expect(login.fieldError(MSG.rutInvalid)).toBeHidden()
            // Pasa la validación del cliente → llega al servidor → credenciales malas
            await expect(login.serverError).toHaveText(MSG.badCredentials)
            expect(calls.length).toBeGreaterThan(0)
        })
    }
})

// ─────────────────────────────────────────────────────────────
// 6.3 Credenciales incorrectas (validación del servidor)
// ─────────────────────────────────────────────────────────────
test.describe("credenciales incorrectas", () => {
    test("usuario inexistente muestra el mensaje genérico", async () => {
        await login.login(RUT_INEXISTENTE, "Incorrecta123")

        await expect(login.serverError).toBeVisible()
        await expect(login.serverError).toHaveText(MSG.badCredentials)
    })

    test("contraseña incorrecta muestra el MISMO mensaje (sin enumeración)", async () => {
        test.skip(!USER_RUT, "Falta E2E_USER_RUT en .env.e2e")

        await login.login(USER_RUT!, "ClaveEquivocada999")

        await expect(login.serverError).toHaveText(MSG.badCredentials)
    })

    test("después del error se vacía la contraseña y se conserva el RUT", async () => {
        await login.login(RUT_INEXISTENTE, "Incorrecta123")

        await expect(login.serverError).toBeVisible()
        await expect(login.rut).toHaveValue(RUT_INEXISTENTE)
        await expect(login.password).toHaveValue("")
    })

    test("contraseña de solo espacios pasa el cliente y la rechaza el servidor", async () => {
        await login.login(RUT_INEXISTENTE, "     ")

        await expect(login.fieldError(MSG.passwordRequired)).toBeHidden()
        await expect(login.serverError).toHaveText(MSG.badCredentials)
    })

    test("el aviso se puede cerrar", async () => {
        await login.login(RUT_INEXISTENTE, "Incorrecta123")
        await expect(login.serverError).toBeVisible()

        await login.serverError.getByRole("button", { name: /close|cerrar/i }).click()

        await expect(login.serverError).toBeHidden()
    })

    test("no queda cookie de sesión", async ({ context }) => {
        await login.login(RUT_INEXISTENTE, "Incorrecta123")
        await expect(login.serverError).toBeVisible()

        const cookies = await context.cookies()
        expect(cookies.find((c) => c.name === "_medusa_jwt")).toBeUndefined()
    })
})

// ─────────────────────────────────────────────────────────────
// 6.4 Comportamiento del formulario
// ─────────────────────────────────────────────────────────────
test.describe("comportamiento del formulario", () => {
    test("el ojo muestra y oculta la contraseña", async () => {
        await login.password.fill("Secreta123")
        await expect(login.password).toHaveAttribute("type", "password")

        await login.togglePassword.click()
        await expect(login.password).toHaveAttribute("type", "text")
        await expect(login.togglePassword).toHaveAccessibleName("Ocultar contraseña")

        await login.togglePassword.click()
        await expect(login.password).toHaveAttribute("type", "password")
    })

    test("Enter envía el formulario", async () => {
        await login.rut.fill(RUT_INEXISTENTE)
        await login.password.fill("Incorrecta123")
        await login.password.press("Enter")

        await expect(login.serverError).toHaveText(MSG.badCredentials)
    })

    test("link de recuperar contraseña", async ({ page }) => {
        await login.forgotPassword.click()
        
        //await expect(page).toHaveURL(/\/cl\/recover-password/)

        await expect(page).toHaveURL(/\/cl\/recover-password/, { timeout: 30_000 })
        await expect(page.getByTestId("recover-password-page")).toBeVisible()
    })
})

// ─────────────────────────────────────────────────────────────
// 6.5 Login exitoso (requiere el usuario de prueba)
// ─────────────────────────────────────────────────────────────
test.describe("login exitoso", () => {
    test.skip(
        !USER_RUT || !USER_PASSWORD,
        "Define E2E_USER_RUT y E2E_USER_PASSWORD en .env.e2e"
    )

    test("entra a la cuenta y deja la cookie de sesión", async ({ page, context }) => {
        await login.login(USER_RUT!, USER_PASSWORD!)

        await expect(page.getByTestId("overview-page-wrapper")).toBeVisible()

        const cookies = await context.cookies()
        const jwt = cookies.find((c) => c.name === "_medusa_jwt")
        expect(jwt).toBeDefined()
        expect(jwt!.httpOnly).toBe(true)
    })

    test("vuelve a la página protegida que se pidió (redirect_to)", async ({ page }) => {
        await page.goto("/cl/store")
        await expect(page).toHaveURL(/\/cl\/account\?redirect_to=/)

        await login.login(USER_RUT!, USER_PASSWORD!)

        // redirect() renderiza /cl/store en la misma respuesta; en `next dev`
        // la primera vez se compila la ruta, por eso el margen extra.
        await expect(page).toHaveURL(/\/cl\/store/, { timeout: 30_000 })
    })

    // getSafeRedirect() solo acepta rutas internas: "/..." sin "//" ni "://"
    // Estos dos los rechaza → no hay redirección y se ve la cuenta.
    for (const evil of ["https://evil.com", "//evil.com"]) {
        test(`no redirige fuera del sitio con redirect_to=${evil}`, async ({ page }) => {
            await login.goto(evil)
            await login.login(USER_RUT!, USER_PASSWORD!)

            await expect(page.getByTestId("overview-page-wrapper")).toBeVisible({ timeout: 30_000 })
            expect(new URL(page.url()).host).toBe("localhost:8000")
        })
    }

    // "/\evil.com" SÍ pasa el filtro de getSafeRedirect (empieza con "/",
    // no con "//", y no tiene "://"). Lo que importa es no terminar fuera del sitio.
    test("redirect_to=/\\evil.com no saca al usuario del sitio", async ({ page }) => {
        await login.goto("/\\evil.com")
        await login.login(USER_RUT!, USER_PASSWORD!)

        // Espera a que el action termine (el botón deja de decir "Ingresando...")
        await expect(page.getByRole("button", { name: "Ingresando..." })).toHaveCount(0, { timeout: 30_000 })
        expect(new URL(page.url()).host).toBe("localhost:8000")
    })
})

// ─────────────────────────────────────────────────────────────
// 6.6 Otros flujos de rut-auth: first-login.spec.ts y account-disabled.spec.ts
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// 6.7 Lockout (rut-auth, paso 7)
// ─────────────────────────────────────────────────────────────
// Usa un colaborador DEDICADO (E2E_LOCKOUT_RUT / E2E_LOCKOUT_PASSWORD, con la
// clave inicial ya cambiada): el test lo deja bloqueado 15 minutos. No uses
// E2E_USER_RUT, que comparten los demás specs.
test.describe("lockout", () => {
    const LOCK_RUT = process.env.E2E_LOCKOUT_RUT
    const LOCK_PASSWORD = process.env.E2E_LOCKOUT_PASSWORD
    test.skip(
        !LOCK_RUT || !LOCK_PASSWORD,
        "Define E2E_LOCKOUT_RUT y E2E_LOCKOUT_PASSWORD (usuario dedicado) en .env.e2e"
    )

    test("tras 5 intentos fallidos ni la clave correcta entra, con el mismo mensaje", async ({ page }) => {
        for (let i = 0; i < 5; i++) {
            await login.login(LOCK_RUT!, `ClaveEquivocada${i}`)
            await expect(login.serverError).toHaveText(MSG.badCredentials, { timeout: 30_000 })
            await login.serverError.getByRole("button", { name: /close|cerrar/i }).click()
        }

        await login.login(LOCK_RUT!, LOCK_PASSWORD!)

        await expect(login.serverError).toHaveText(MSG.badCredentials, { timeout: 30_000 })
        await expect(page.getByTestId("overview-page-wrapper")).toHaveCount(0)
    })
})
