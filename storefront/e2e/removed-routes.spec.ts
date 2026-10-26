import { expect, test } from "@playwright/test"
import { AUTH_FILE } from "./constants"

/*

Vulnerabilidad #1 (docs/vulnerabilidades.md): las vistas Company y Approvals
del B2B Starter se eliminaron del storefront. Con un colaborador logueado
(sesión de auth.setup.ts) deben responder 404 y mostrar la página
"¡Lo siento, página no encontrada!", no la vista anterior.

*/
test.use({ storageState: AUTH_FILE })

for (const ruta of ["/cl/account/company", "/cl/account/approvals"]) {
    test(`${ruta} responde 404 con la página de no encontrado`, async ({ page }) => {
        const res = await page.goto(ruta, { waitUntil: "domcontentloaded" })

        expect(res?.status()).toBe(404)
        await expect(
            page.getByRole("heading", { name: "¡Lo siento, página no encontrada!" })
        ).toBeVisible()
        await expect(page.getByText("Employees")).toHaveCount(0)
    })
}
