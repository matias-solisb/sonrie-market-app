import { expect, test, type Page } from "@playwright/test"
import { AUTH_FILE } from "./constants"
import { CartPage } from "./pages/shop"

/*
Catálogo: búsqueda, filtros (categorías y "Ofertas"), ficha de producto y stock.

- Búsqueda: barra del header (modules/layout/components/search-bar) → /cl/products?q=
- Sin resultados: EmptyProductsState ("Tu búsqueda no arrojó resultados").
- "Ofertas": ?promotions=true se traduce al product tag "promotions" creado en el
  Admin. Si ese tag no existe, el filtro se ignora y se muestran TODOS los productos.
- Sin stock: define E2E_OUT_OF_STOCK_HANDLE en .env.e2e con el handle de un
  producto con inventario 0 (y manage_inventory activo, sin backorder).
*/

test.use({ storageState: AUTH_FILE })
test.describe.configure({ timeout: 90_000 })

test.beforeEach(async ({ page }) => {
    // Cada test parte sin carrito.
    await page.context().clearCookies({ name: "_medusa_cart_id" })
})

const OUT_OF_STOCK_HANDLE = process.env.E2E_OUT_OF_STOCK_HANDLE

// ─── helpers ────────────────────────────────────────────────
async function gotoProducts(page: Page, query = "") {
    await page.goto(`/cl/products${query}`)
    await expect(page.getByTestId("products-count").or(page.getByTestId("empty-products-state")).first())
        .toBeVisible({ timeout: 30_000 })
}

/** "8 productos encontrados" → 8 (0 si aparece el estado vacío). */
async function productCount(page: Page) {
    const label = page.getByTestId("products-count")
    if (!(await label.isVisible().catch(() => false))) return 0
    return Number(((await label.textContent()) ?? "").replace(/\D/g, ""))
}

async function search(page: Page, term: string) {
    // El header tiene dos barras (escritorio y celular): se usa la visible.
    const input = page.getByTestId("nav-search-input").filter({ visible: true }).first()
    await input.fill(term)
    await input.press("Enter")
}

async function firstProductTitle(page: Page) {
    const title = page.getByTestId("product-wrapper").first().getByTestId("product-title")
    return ((await title.textContent()) ?? "").trim()
}

// ─────────────────────────────────────────────────────────────
// 1. Búsqueda
// ─────────────────────────────────────────────────────────────
test.describe("búsqueda", () => {
    test("un término que existe devuelve ese producto", async ({ page }) => {
        await gotoProducts(page)
        const title = await firstProductTitle(page)
        const term = title.split(/\s+/)[0] // primera palabra del primer producto

        await search(page, term)

        await expect(page).toHaveURL(new RegExp(`/cl/products\\?q=${encodeURIComponent(term)}`), { timeout: 30_000 })
        expect(await productCount(page)).toBeGreaterThan(0)
        await expect(page.getByTestId("products-list")).toContainText(term)
    })

    test("un término que no existe muestra el mensaje de sin resultados", async ({ page }) => {
        await gotoProducts(page)

        await search(page, "zzqx-producto-inexistente")

        await expect(page.getByTestId("empty-products-state")).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId("empty-products-state")).toContainText("Tu búsqueda no arrojó resultados")
        await expect(page.getByTestId("product-wrapper")).toHaveCount(0)
    })

    test("la búsqueda vacía muestra todo el catálogo", async ({ page }) => {
        await gotoProducts(page)
        const total = await productCount(page)

        await search(page, "   ")

        await expect(page).not.toHaveURL(/q=/)
        expect(await productCount(page)).toBe(total)
    })

    test("los espacios alrededor del término se ignoran", async ({ page }) => {
        await gotoProducts(page)
        const term = (await firstProductTitle(page)).split(/\s+/)[0]

        await search(page, `   ${term}   `)

        await expect(page).toHaveURL(new RegExp(`\\?q=${encodeURIComponent(term)}$`), { timeout: 30_000 })
    })

    test("caracteres especiales no rompen la página ni se ejecutan", async ({ page }) => {
        const errors: string[] = []
        page.on("pageerror", (e) => errors.push(e.message))
        let dialogOpened = false
        page.on("dialog", async (d) => { dialogOpened = true; await d.dismiss() })
        await gotoProducts(page)

        await search(page, `<script>alert(1)</script> % & "'`)

        await expect(page.getByTestId("empty-products-state").or(page.getByTestId("products-list")).first())
            .toBeVisible({ timeout: 30_000 })
        expect(dialogOpened).toBe(false)
        expect(errors).toEqual([])
    })
})

// ─────────────────────────────────────────────────────────────
// 2. Filtros
// ─────────────────────────────────────────────────────────────
test.describe("filtros", () => {
    test("filtrar por categoría desde el panel reduce o mantiene el total, y quitarlo lo restaura", async ({ page }) => {
        await gotoProducts(page)
        const total = await productCount(page)

        const trigger = page.getByTestId("catalog-categories-trigger")
        if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click()
        const category = page.locator('[data-testid^="catalog-filter-category-"]').first()
        // El checkbox es controlado por la URL: se marca recién cuando termina la
        // navegación (router.push). Por eso click() y no check(), que revisa el
        // estado al instante y falla si la navegación tarda.
        await category.click()

        await expect(page).toHaveURL(/category_id=/, { timeout: 30_000 })
        await expect(category).toBeChecked()
        const filtered = await productCount(page)
        expect(filtered).toBeLessThanOrEqual(total)

        await category.click()
        await expect(page).not.toHaveURL(/category_id=/, { timeout: 30_000 })
        await expect(category).not.toBeChecked()
        await expect.poll(() => productCount(page)).toBe(total)
    })

    test("una categoría del menú superior abre el catálogo filtrado", async ({ page }) => {
        await gotoProducts(page)
        // Las categorías del header están en su propia barra (data-testid="nav-categories"),
        // fuera del <nav>. Se usa el link visible por si en celular la lista cambia.
        const link = page
            .getByTestId("nav-categories")
            .locator('a[href*="category_id="]')
            .filter({ visible: true })
            .first()
        const name = ((await link.textContent()) ?? "").trim()

        await link.click()

        await expect(page).toHaveURL(/\/cl\/products\?category_id=/, { timeout: 30_000 })
        await expect(page.getByTestId("products-count").or(page.getByTestId("empty-products-state")).first())
            .toBeVisible()
        test.info().annotations.push({ type: "categoría", description: name })
    })

    test('"Ofertas" filtra el catálogo y marca el filtro activo', async ({ page }) => {
        await gotoProducts(page)
        const total = await productCount(page)

        await page.getByRole("link", { name: "Ofertas", exact: true }).first().click()

        await expect(page).toHaveURL(/promotions=true/, { timeout: 30_000 })
        await expect(page.getByTestId("catalog-filter-ofertas")).toBeChecked()
        await expect(page.getByTestId("selected-quick-filter-badge-ofertas")).toBeVisible()

        // Si el tag "promotions" no existe en el Admin, el filtro se ignora y
        // "Ofertas" muestra el catálogo completo.
        const offers = await productCount(page)
        expect(offers, 'Ofertas muestra el mismo total que el catálogo: ¿existe el tag "promotions" en el Admin?')
            .toBeLessThan(total)
    })
})

// ─────────────────────────────────────────────────────────────
// 3. Ficha de producto
// ─────────────────────────────────────────────────────────────
test.describe("ficha de producto", () => {
    async function openFirstProduct(page: Page) {
        await gotoProducts(page)
        const card = page.getByTestId("product-wrapper").first()
        const title = ((await card.getByTestId("product-title").textContent()) ?? "").trim()
        await card.getByRole("link").first().click()
        await expect(page).toHaveURL(/\/cl\/products\/[^/?]+/, { timeout: 30_000 })
        await expect(page.getByTestId("product-container")).toBeVisible()
        return title
    }

    test("abrir la ficha desde el listado muestra el mismo producto", async ({ page }) => {
        const title = await openFirstProduct(page)
        await expect(page.getByTestId("product-container").getByTestId("product-title")).toHaveText(title)
    })

    test("agregar desde la ficha lo deja en el carrito", async ({ page }) => {
        const title = await openFirstProduct(page)
        const container = page.getByTestId("product-container")

        await container.getByTestId("add-to-cart-button").click()
        await expect(container.getByTestId("cart-quantity-value")).toHaveText("1", { timeout: 30_000 })

        const cart = new CartPage(page)
        await cart.goto()
        await expect(page.getByTestId("cart-items-container")).toContainText(title)
        await expect(cart.quantityInput).toHaveValue("1")
    })

    test("el stepper de la ficha suma unidades y el carrito lo refleja", async ({ page }) => {
        await openFirstProduct(page)
        const container = page.getByTestId("product-container")

        await container.getByTestId("add-to-cart-button").click()
        const value = container.getByTestId("cart-quantity-value")
        await expect(value).toHaveText("1", { timeout: 30_000 })
        await container.getByRole("button", { name: "Agregar una unidad" }).click()
        await expect(value).toHaveText("2")

        const cart = new CartPage(page)
        await cart.goto()
        await expect(cart.quantityInput).toHaveValue("2")
    })
})

// ─────────────────────────────────────────────────────────────
// 4. Producto sin stock
// ─────────────────────────────────────────────────────────────
test.describe("producto sin stock", () => {
    test.skip(!OUT_OF_STOCK_HANDLE, "Define E2E_OUT_OF_STOCK_HANDLE en .env.e2e")

    test("no queda en el carrito aunque se presione Agregar", async ({ page }) => {
        await page.goto(`/cl/products/${OUT_OF_STOCK_HANDLE}`)
        const container = page.getByTestId("product-container")
        await expect(container).toBeVisible({ timeout: 30_000 })
        const title = ((await container.getByTestId("product-title").textContent()) ?? "").trim()

        const add = container.getByTestId("add-to-cart-button")
        if (await add.isEnabled().catch(() => false)) {
            await add.click()
            await page.waitForTimeout(3_000) // deja terminar el intento de agregar
        }

        await page.goto("/cl/cart")
        await expect(page.getByTestId("cart-container")).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId("cart-items-container").getByText(title)).toHaveCount(0)
    })

    // BUG probable: ni el listado ni la ficha leen el inventario. El botón
    // "Agregar" se muestra igual y, si el backend rechaza el producto, el error
    // solo va a console.error (AddToCartStepper): el colaborador no ve nada.
    // Cuando se agregue un aviso, este test pasa y hay que quitar el test.fail().
    test("la ficha avisa que el producto está agotado", async ({ page }) => {
        test.fail()
        await page.goto(`/cl/products/${OUT_OF_STOCK_HANDLE}`)
        await expect(page.getByTestId("product-container")).toBeVisible({ timeout: 30_000 })

        await expect(page.getByText(/agotado|sin stock/i).first()).toBeVisible({ timeout: 5_000 })
    })
})
