import { expect, test as setup } from "@playwright/test"
import { AUTH_FILE } from "./constants"
import { LoginPage } from "./pages/login-page"

setup("iniciar sesión con el usuario de prueba", async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL
    const password = process.env.E2E_USER_PASSWORD
    setup.skip(!email || !password, "Define E2E_USER_EMAIL y E2E_USER_PASSWORD en .env.e2e")

    const login = new LoginPage(page)
    await login.goto()
    await login.login(email!, password!)
    await expect(page.getByTestId("overview-page-wrapper")).toBeVisible({ timeout: 30_000 })

    // Solo la sesión: sin carrito, así cada test arranca con el carrito vacío.
    await page.context().storageState({ path: AUTH_FILE })
})
