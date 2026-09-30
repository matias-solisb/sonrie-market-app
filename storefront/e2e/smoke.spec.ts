import { expect, test } from "@playwright/test"

test("la página de login carga", async ({ page }) => {
    await page.goto("/cl/account")

    await expect(page.getByTestId("login-page")).toBeVisible()
    await expect(
        page.getByText("Bienvenido a Sonríe Market Store")
    ).toBeVisible()
})

test("sin sesión, el home redirige al login con redirect_to", async ({ page }) => {
    await page.goto("/cl")

    // El middleware corta las rutas protegidas y manda a /cl/account?redirect_to=/cl
    await expect(page).toHaveURL(/\/cl\/account\?redirect_to=%2Fcl/)
    await expect(page.getByTestId("login-page")).toBeVisible()
})