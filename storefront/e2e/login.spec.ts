import { expect, test, type Page } from "@playwright/test"
import { LoginPage } from "./pages/login-page"

const USER_EMAIL = process.env.E2E_USER_EMAIL
const USER_PASSWORD = process.env.E2E_USER_PASSWORD

const MSG = {
    emailRequired: "El Correo es requerido",
    emailInvalid: "Debe ser un email válido",
    passwordRequired: "La Contraseña es requerida",
    badCredentials: "Usuario y contraseña no coinciden",
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

        await expect(login.fieldError(MSG.emailRequired)).toBeVisible()
        await expect(login.fieldError(MSG.passwordRequired)).toBeVisible()
        await expect(login.email).toHaveAttribute("aria-invalid", "true")
        await expect(login.password).toHaveAttribute("aria-invalid", "true")
        expect(calls).toHaveLength(0)
    })

    test("solo correo vacío", async () => {
        await login.password.fill("cualquiera")
        await login.submit.click()

        await expect(login.fieldError(MSG.emailRequired)).toBeVisible()
        await expect(login.fieldError(MSG.passwordRequired)).toBeHidden()
    })

    test("solo contraseña vacía", async () => {
        await login.email.fill("test@sonriemarket.cl")
        await login.submit.click()

        await expect(login.fieldError(MSG.passwordRequired)).toBeVisible()
        await expect(login.fieldError(MSG.emailRequired)).toBeHidden()
    })

    test("correo con solo espacios cuenta como vacío", async () => {
        await login.email.fill("     ")
        await login.password.fill("cualquiera")
        await login.submit.click()

        await expect(login.fieldError(MSG.emailRequired)).toBeVisible()
    })

    test("el error desaparece al escribir (revalidación onChange)", async () => {
        await login.submit.click()
        await expect(login.fieldError(MSG.emailRequired)).toBeVisible()

        await login.email.fill("test@sonriemarket.cl")

        await expect(login.fieldError(MSG.emailRequired)).toBeHidden()
        await expect(login.email).toHaveAttribute("aria-invalid", "false")
    })
})

// ─────────────────────────────────────────────────────────────
// 6.2 Correo mal escrito: un test por cada caso (test parametrizado)
// ─────────────────────────────────────────────────────────────
test.describe("correo con formato inválido", () => {
    const invalidEmails = [
        "matias",               // sin @
        "matias@",              // sin dominio
        "@quantor.cl",          // sin usuario
        "matias@quantor",       // sin TLD
        "matias@quantor.c",     // TLD de 1 letra
        "matias quantor.cl",    // espacio en vez de @
        "matias@@quantor.cl",   // doble @
        ".matias@quantor.cl",   // empieza con punto
        "matias..solis@quantor.cl", // puntos consecutivos
    ]

    for (const email of invalidEmails) {
        test(`rechaza "${email}"`, async ({ page }) => {
            const calls = trackServerActions(page)

            await login.login(email, "cualquiera")

            await expect(login.fieldError(MSG.emailInvalid)).toBeVisible()
            expect(calls).toHaveLength(0)
        })
    }

    test("acepta un correo con espacios alrededor (trim)", async ({ page }) => {
        const calls = trackServerActions(page)

        await login.login("  noexiste@sonriemarket.cl  ", "Incorrecta123")

        await expect(login.fieldError(MSG.emailInvalid)).toBeHidden()
        // Pasa la validación del cliente → llega al servidor → credenciales malas
        await expect(login.serverError).toHaveText(MSG.badCredentials)
        expect(calls.length).toBeGreaterThan(0)
    })
})

// ─────────────────────────────────────────────────────────────
// 6.3 Credenciales incorrectas (validación del servidor)
// ─────────────────────────────────────────────────────────────
test.describe("credenciales incorrectas", () => {
    test("usuario inexistente muestra el mensaje genérico", async () => {
        await login.login("noexiste@sonriemarket.cl", "Incorrecta123")

        await expect(login.serverError).toBeVisible()
        await expect(login.serverError).toHaveText(MSG.badCredentials)
    })

    test("contraseña incorrecta muestra el MISMO mensaje (sin enumeración)", async () => {
        test.skip(!USER_EMAIL, "Falta E2E_USER_EMAIL en .env.e2e")

        await login.login(USER_EMAIL!, "ClaveEquivocada999")

        await expect(login.serverError).toHaveText(MSG.badCredentials)
    })

    test("después del error se vacían ambos campos", async () => {
        await login.login("noexiste@sonriemarket.cl", "Incorrecta123")

        await expect(login.serverError).toBeVisible()
        await expect(login.email).toHaveValue("")
        await expect(login.password).toHaveValue("")
    })

    test("contraseña de solo espacios pasa el cliente y la rechaza el servidor", async () => {
        await login.login("noexiste@sonriemarket.cl", "     ")

        await expect(login.fieldError(MSG.passwordRequired)).toBeHidden()
        await expect(login.serverError).toHaveText(MSG.badCredentials)
    })

    test("el aviso se puede cerrar", async () => {
        await login.login("noexiste@sonriemarket.cl", "Incorrecta123")
        await expect(login.serverError).toBeVisible()

        await login.serverError.getByRole("button", { name: /close|cerrar/i }).click()

        await expect(login.serverError).toBeHidden()
    })

    test("no queda cookie de sesión", async ({ context }) => {
        await login.login("noexiste@sonriemarket.cl", "Incorrecta123")
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
        await login.email.fill("noexiste@sonriemarket.cl")
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
        !USER_EMAIL || !USER_PASSWORD,
        "Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.e2e"
    )

    test("entra a la cuenta y deja la cookie de sesión", async ({ page, context }) => {
        await login.login(USER_EMAIL!, USER_PASSWORD!)

        await expect(page.getByTestId("overview-page-wrapper")).toBeVisible()
        await expect(page.getByTestId("customer-email")).toContainText(USER_EMAIL!)

        const cookies = await context.cookies()
        const jwt = cookies.find((c) => c.name === "_medusa_jwt")
        expect(jwt).toBeDefined()
        expect(jwt!.httpOnly).toBe(true)
    })

    test("vuelve a la página protegida que se pidió (redirect_to)", async ({ page }) => {
        await page.goto("/cl/store")
        await expect(page).toHaveURL(/\/cl\/account\?redirect_to=/)

        await login.login(USER_EMAIL!, USER_PASSWORD!)

        // redirect() renderiza /cl/store en la misma respuesta; en `next dev`
        // la primera vez se compila la ruta, por eso el margen extra.
        await expect(page).toHaveURL(/\/cl\/store/, { timeout: 30_000 })
    })

    // getSafeRedirect() solo acepta rutas internas: "/..." sin "//" ni "://"
    // Estos dos los rechaza → no hay redirección y se ve la cuenta.
    for (const evil of ["https://evil.com", "//evil.com"]) {
        test(`no redirige fuera del sitio con redirect_to=${evil}`, async ({ page }) => {
            await login.goto(evil)
            await login.login(USER_EMAIL!, USER_PASSWORD!)

            await expect(page.getByTestId("overview-page-wrapper")).toBeVisible({ timeout: 30_000 })
            expect(new URL(page.url()).host).toBe("localhost:8000")
        })
    }

    // "/\evil.com" SÍ pasa el filtro de getSafeRedirect (empieza con "/",
    // no con "//", y no tiene "://"). Lo que importa es no terminar fuera del sitio.
    test("redirect_to=/\\evil.com no saca al usuario del sitio", async ({ page }) => {
        await login.goto("/\\evil.com")
        await login.login(USER_EMAIL!, USER_PASSWORD!)

        // Espera a que el action termine (el botón deja de decir "Ingresando...")
        await expect(page.getByRole("button", { name: "Ingresando..." })).toHaveCount(0, { timeout: 30_000 })
        expect(new URL(page.url()).host).toBe("localhost:8000")
    })
})

// ─────────────────────────────────────────────────────────────
// 6.6 Pendientes para cuando exista rut-auth (Fase 1a)
// ─────────────────────────────────────────────────────────────
test.describe("rut-auth (futuro)", () => {
    test.fixme("RUT con DV inválido (módulo 11) se rechaza en el cliente", async () => { })
    test.fixme("primer ingreso obliga a cambiar la clave", async () => { })
    test.fixme("lockout tras N intentos fallidos", async () => { })
    test.fixme("usuario deshabilitado desde el backoffice no puede entrar", async () => { })
})