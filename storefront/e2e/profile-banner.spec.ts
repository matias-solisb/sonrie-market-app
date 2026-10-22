import { expect, test, type Page } from "@playwright/test"
import { AUTH_FILE } from "./constants"
import { LoginPage } from "./pages/login-page"

/*

Franja de perfil incompleto (ProfileIncompleteBanner) y punto del menú de
usuario, con el colaborador de prueba (E2E_USER_*, sesión de auth.setup.ts).

⚠️ Modifica el teléfono del usuario de prueba: lo borra y al final lo deja en
TELEFONO_PRUEBA (no restaura el valor que tenía antes).

*/
test.use({ storageState: AUTH_FILE })

const TELEFONO_PRUEBA = "912345678"
const USER_RUT = process.env.E2E_USER_RUT
const USER_PASSWORD = process.env.E2E_USER_PASSWORD

async function guardarTelefono(page: Page, telefono: string) {
    await page.goto("/cl/account/profile")
    await page.getByRole("button", { name: "Editar Datos" }).click()
    await page.locator('input[name="phone_local"]').fill(telefono)
    await page.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(page.getByText("Su perfil ha sido actualizado")).toBeVisible({ timeout: 30_000 })
}

test("sin teléfono: avisa en el home, lleva al perfil y desaparece al completarlo", async ({ page }) => {
    const banner = page.getByTestId("profile-incomplete-banner")

    await guardarTelefono(page, "")

    // En el perfil no se muestra: ahí ya está el formulario
    await expect(banner).toHaveCount(0)

    // Viene en el HTML del servidor (cookie, no sessionStorage): no aparece
    // después de hidratar empujando el home hacia abajo.
    const res = await page.goto("/cl")
    expect(await res!.text()).toContain('data-testid="profile-incomplete-banner"')
    await expect(banner).toBeVisible({ timeout: 30_000 })
    await expect(banner).toContainText("Te falta registrar tu teléfono")
    await expect(banner).toHaveAttribute("data-value", "phone")
    await expect(page.getByTestId("nav-account-menu-profile-dot")).toBeAttached()

    await page.getByTestId("profile-incomplete-banner-link").click()
    await expect(page).toHaveURL(/\/cl\/account\/profile/, { timeout: 30_000 })
    await expect(banner).toHaveCount(0)

    // La ✕ la oculta durante la sesión, aunque se recargue
    await page.goto("/cl")
    await page.getByTestId("profile-incomplete-banner-close").click()
    await expect(banner).toHaveCount(0)
    await page.reload()
    await expect(page.getByTestId("nav-account-menu-button")).toBeVisible({ timeout: 30_000 })
    await expect(banner).toHaveCount(0)

    await guardarTelefono(page, TELEFONO_PRUEBA)

    await page.goto("/cl")
    await expect(page.getByTestId("nav-account-menu-button")).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId("nav-account-menu-profile-dot")).toHaveCount(0)
    await expect(banner).toHaveCount(0)
})

test("al iniciar sesión el home queda arriba, aunque el login estuviera desplazado", async ({ browser }) => {
    test.skip(!USER_RUT || !USER_PASSWORD, "Define E2E_USER_RUT y E2E_USER_PASSWORD en .env.e2e")

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()
    // Ventana baja: el formulario + footer no caben y se puede desplazar
    await page.setViewportSize({ width: 1280, height: 600 })

    const login = new LoginPage(page)
    await login.goto()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

    await login.login(USER_RUT!, USER_PASSWORD!)
    await login.expectHome()

    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    // Nada empuja el contenido después de cargar (ni la franja ni otra cosa).
    // El header es sticky: se mide el carrusel del home (si hay banners).
    const hero = page.getByTestId("hero-carousel")
    if (await hero.count()) {
        const antes = (await hero.boundingBox())!.y
        await page.waitForTimeout(1_500)
        expect((await hero.boundingBox())!.y).toBe(antes)
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    await ctx.close()
})
