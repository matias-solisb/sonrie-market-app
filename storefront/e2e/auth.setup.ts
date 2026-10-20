import { expect, test as setup } from "@playwright/test"
import { AUTH_FILE } from "./constants"
import { LoginPage } from "./pages/login-page"

setup("iniciar sesión con el usuario de prueba", async ({ page }) => {
    const rut = process.env.E2E_USER_RUT
    const password = process.env.E2E_USER_PASSWORD
    setup.skip(!rut || !password, "Define E2E_USER_RUT y E2E_USER_PASSWORD en .env.e2e")

    const login = new LoginPage(page)
    await login.goto()
    await login.login(rut!, password!)
    await expect(page.getByTestId("overview-page-wrapper")).toBeVisible({ timeout: 30_000 })

    // Solo la sesión: sin carrito, así cada test arranca con el carrito vacío.
    await page.context().storageState({ path: AUTH_FILE })
})
