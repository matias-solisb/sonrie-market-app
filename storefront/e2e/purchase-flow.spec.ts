import { expect, test, type Page } from "@playwright/test"
import { AUTH_FILE } from "./constants"
import { LoginPage } from "./pages/login-page"
import { CartPage, CheckoutPage, StorePage, parseClp } from "./pages/shop"

/*
Escenarios de fallo del flujo de compra: catálogo → carrito → checkout → pedido.

Requisitos en el ambiente dev:
- Usuario de prueba de .env.e2e (sesión guardada por auth.setup.ts).
- Al menos un producto con stock en /cl/store.
- Para la sección "checkout": sites de retiro configurados
  (backend: `npx medusa exec ./src/scripts/setup-pickup-sites.ts`), stock del
  producto en el primer site, campaña de beneficio activa y saldo suficiente
  (cada corrida del flujo completo crea pedidos reales que consumen beneficio).

Varios tests de "cantidades inválidas" están escritos con el comportamiento
ESPERADO. Si fallan, probablemente encontraron un bug real en
modules/cart/components/item-full (handleBlur / handleKeyDown no validan).
*/

test.use({ storageState: AUTH_FILE })

/** Cuenta las llamadas a server actions (POST con header `next-action`). */
function trackServerActions(page: Page) {
    const calls: string[] = []
    page.on("request", (req) => {
        if (req.method() === "POST" && req.headers()["next-action"]) calls.push(req.url())
    })
    return calls
}

/**
 * Agrega el producto más barato del catálogo y abre el carrito. No el
 * primero: si cuesta más que el cupo del mes, el carrito se bloquea por
 * "Saldo insuficiente" y los tests de checkout fallan por los datos de dev.
 */
async function cartWithOneItem(page: Page) {
    const store = new StorePage(page)
    await store.goto()
    const title = await store.addCheapestProduct()
    const cart = new CartPage(page)
    await cart.goto()
    await expect(cart.quantityInput).toHaveValue("1")
    return { cart, title }
}

// ─────────────────────────────────────────────────────────────
// 1. Catálogo y carrito
// ─────────────────────────────────────────────────────────────
test("sin productos no se puede confirmar el pedido", async ({ page }) => {
    const cart = new CartPage(page)
    await cart.goto()

    await expect(cart.quantityControl).toHaveCount(0)
    // No hay botón o está deshabilitado: en ningún caso se puede avanzar
    if (await cart.checkoutButton.count()) {
        await expect(cart.checkoutButton).toBeDisabled()
    }
})

// BUG conocido: con un carrito creado pero vacío no se muestra ni el mensaje
// ni el resumen (Summary exige cart.region). Cuando se corrija, este test
// empieza a pasar y Playwright avisa que hay que quitar el test.fail().
test("carrito vacío muestra un mensaje al colaborador", async ({ page }) => {
    test.fail()
    const cart = new CartPage(page)
    await cart.goto()

    await expect(cart.emptyMessage).toBeVisible({ timeout: 5_000 })
})

// ─────────────────────────────────────────────────────────────
// 2. Cantidades inválidas en el input del carrito
//    (comportamiento ESPERADO; un fallo aquí apunta a item-full)
// ─────────────────────────────────────────────────────────────
test.describe("cantidades inválidas", () => {
    test("cantidad 0 + Enter elimina el producto", async ({ page }) => {
        const { cart } = await cartWithOneItem(page)

        await cart.typeQuantity("0", "Enter")

        await expect(cart.quantityControl).toHaveCount(0, { timeout: 15_000 })
    })

    for (const confirm of ["Enter", "Tab"] as const) {
        test(`cantidad negativa (-5) + ${confirm} no deja una cantidad negativa`, async ({ page }) => {
            const { cart } = await cartWithOneItem(page)

            await cart.typeQuantity("-5", confirm)
            await page.reload()

            // O se eliminó el producto, o quedó una cantidad válida (≥ 1).
            if (await cart.quantityControl.count()) {
                const qty = Number(await cart.quantityInput.inputValue())
                expect(qty).toBeGreaterThanOrEqual(1)
            }
        })

        test(`cantidad muy superior al stock (99999) + ${confirm} no se acepta`, async ({ page }) => {
            const { cart } = await cartWithOneItem(page)

            await cart.typeQuantity("99999", confirm)
            await page.reload()

            await expect(cart.quantityInput).not.toHaveValue("99999")
        })
    }

    // input[type=number] no acepta letras (el navegador lo bloquea), así que
    // "abc" no es un caso real. Sí lo son el campo vacío y la notación científica.
    test("campo de cantidad vacío + Enter no deja el carrito en un estado inválido", async ({ page }) => {
        const { cart } = await cartWithOneItem(page)
        const errors: string[] = []
        page.on("pageerror", (e) => errors.push(e.message))

        await cart.typeQuantity("", "Enter")
        await page.reload()

        await expect(page.getByTestId("cart-container")).toBeVisible()
        // O se eliminó el producto, o quedó una cantidad válida (≥ 1)
        if (await cart.quantityControl.count()) {
            const qty = Number(await cart.quantityInput.inputValue())
            expect(qty).toBeGreaterThanOrEqual(1)
        }
        expect(errors).toEqual([])
    })

    test("notación científica (1e3) no permite saltarse el stock", async ({ page }) => {
        const { cart } = await cartWithOneItem(page)

        await cart.typeQuantity("1e3", "Enter")
        await page.reload()

        // 1e3 = 1000: no debería quedar una cantidad mayor al stock disponible
        const qty = Number(await cart.quantityInput.inputValue())
        expect(qty).toBeLessThan(1000)
    })
})

// ─────────────────────────────────────────────────────────────
// 3. Acceso al checkout
// ─────────────────────────────────────────────────────────────
test.describe("acceso al checkout", () => {
    test.describe("sin sesión", () => {
        test.use({ storageState: { cookies: [], origins: [] } })

        test("/cl/checkout no muestra el checkout", async ({ page }) => {
            // /checkout no está en PROTECTED_PATH_REGEX del middleware: se comprueba
            // que igual no se pueda llegar a pagar.
            await page.goto("/cl/checkout")
            await expect(page.getByTestId("submit-order-button")).toHaveCount(0)
        })
    })

    test("con sesión pero sin carrito, /cl/checkout no permite pagar", async ({ page }) => {
        await page.goto("/cl/checkout")
        await expect(page.getByTestId("submit-order-button")).toHaveCount(0)
    })

    test("no se puede ver el carrito de otro colaborador con ?cartId=", async ({ page, browser }) => {
        const email2 = process.env.E2E_USER2_EMAIL
        const password2 = process.env.E2E_USER2_PASSWORD
        test.skip(!email2 || !password2, "Define E2E_USER2_EMAIL y E2E_USER2_PASSWORD en .env.e2e")

        // El colaborador B arma un carrito
        const ctxB = await browser.newContext({ storageState: { cookies: [], origins: [] } })
        const pageB = await ctxB.newPage()
        const loginB = new LoginPage(pageB)
        await loginB.goto()
        await loginB.login(email2!, password2!)
        await expect(pageB.getByTestId("overview-page-wrapper")).toBeVisible({ timeout: 30_000 })
        const { title } = await cartWithOneItem(pageB)
        const cartIdB = (await ctxB.cookies()).find((c) => c.name === "_medusa_cart_id")?.value
        await ctxB.close()
        expect(cartIdB).toBeTruthy()

        // El colaborador A intenta abrirlo
        await page.goto(`/cl/checkout?cartId=${cartIdB}`)
        await expect(page.getByText(title)).toHaveCount(0)
        await expect(page.getByTestId("submit-order-button")).toHaveCount(0)
    })
})

// ─────────────────────────────────────────────────────────────
// 4. Confirmar el pedido (crea pedidos reales en dev)
// ─────────────────────────────────────────────────────────────
test.describe("confirmar pedido", () => {
    test.describe.configure({ mode: "serial" })

    async function goToCheckout(page: Page) {
        const { cart } = await cartWithOneItem(page)
        await cart.checkoutButton.click()
        await expect(page).toHaveURL(/\/cl\/checkout/, { timeout: 30_000 })
        return new CheckoutPage(page)
    }

    async function latestOrderNumber(page: Page) {
        await page.goto("/cl/account/orders")
        const first = page.getByTestId("order-display-id").first()
        // isVisible() no espera (ignora el timeout): con streaming la tabla
        // aparece después del primer render y se leía 0. waitFor sí espera.
        const visible = await first
            .waitFor({ state: "visible", timeout: 15_000 })
            .then(() => true)
            .catch(() => false)
        if (!visible) return 0
        return parseClp(await first.textContent())
    }

    // Antes Summary.handleConfirm calculaba el paso del checkout con el
    // carrito previo (sin dirección) y siempre abría en step=shipping-address.
    // Ahora el backend deja dirección + retiro (POST /store/carts/:id/pickup-site)
    // y el paso se calcula con el carrito actualizado.
    test("al confirmar el carrito, el checkout no vuelve a pedir la dirección del site", async ({ page }) => {
        await goToCheckout(page)

        await expect(page).not.toHaveURL(/step=shipping-address/, { timeout: 5_000 })
    })

    test("sin site confirmado en el carrito, /cl/checkout vuelve al carrito", async ({ page }) => {
        // Agrega un producto pero entra directo al checkout, sin pasar por
        // "Confirmar pedido" del carrito (que es donde se elige el site).
        await cartWithOneItem(page)
        await page.goto("/cl/checkout")

        await expect(page).toHaveURL(/\/cl\/cart/, { timeout: 30_000 })
        await expect(page.getByTestId("submit-order-button")).toHaveCount(0)
    })

    test("el checkout es una sola página con el site, el pago y el botón habilitado", async ({ page }) => {
        const checkout = await goToCheckout(page)

        await expect(page).not.toHaveURL(/step=/)
        await expect(checkout.pickupSiteName).toBeVisible()
        await expect(page.getByTestId("benefit-payment")).toContainText("Cargo beneficio")
        await expect(checkout.placeOrder).toBeEnabled({ timeout: 30_000 })
    })

    test("flujo completo: el pedido se crea, se confirma y el carrito queda vacío", async ({ page }) => {
        const before = await latestOrderNumber(page)
        const checkout = await goToCheckout(page)
        await checkout.completeSteps()

        await checkout.placeOrder.click()

        await expect(page).toHaveURL(/\/cl\/order\/confirmed\//, { timeout: 30_000 })
        await expect(page.getByTestId("order-complete-container")).toBeVisible()

        const cart = new CartPage(page)
        await cart.goto()
        await expect(cart.quantityControl).toHaveCount(0)

        expect(await latestOrderNumber(page)).toBe(before + 1)
    })

    test("doble clic en el botón de pedido crea UN solo pedido", async ({ page }) => {
        const before = await latestOrderNumber(page)
        const checkout = await goToCheckout(page)
        await checkout.completeSteps()
        const calls = trackServerActions(page)

        await checkout.placeOrder.dblclick()

        await expect(page).toHaveURL(/\/cl\/order\/confirmed\//, { timeout: 30_000 })
        expect(calls.length).toBeLessThanOrEqual(1)
        expect(await latestOrderNumber(page)).toBe(before + 1)
    })

    // La regla del cupo (bloqueo al exceder, compras simultáneas) se prueba
    // en el backend: integration-tests/http/benefit-budget/checkout-scenarios.spec.ts.
    // Aquí solo se verifica lo que ve el colaborador.
    test("el medio de pago muestra el saldo del mes y lo descuenta al comprar", async ({ page }) => {
        const checkout = await goToCheckout(page)
        await checkout.completeSteps()

        const disponible = parseClp(await page.getByTestId("benefit-available").textContent())
        const total = parseClp(await page.getByTestId("cart-total").first().textContent())
        expect(total).toBeGreaterThan(0)
        test.skip(disponible < total, "El usuario de prueba no tiene saldo para este pedido")

        expect(parseClp(await page.getByTestId("benefit-after").textContent())).toBe(disponible - total)

        await checkout.placeOrder.click()
        await expect(page).toHaveURL(/\/cl\/order\/confirmed\//, { timeout: 30_000 })

        await goToCheckout(page)
        await expect
            .poll(async () => parseClp(await page.getByTestId("benefit-available").textContent()), { timeout: 30_000 })
            .toBe(disponible - total)
    })

    test("volver atrás después de comprar no permite pagar de nuevo", async ({ page }) => {
        const checkout = await goToCheckout(page)
        await checkout.completeSteps()
        await checkout.placeOrder.click()
        await expect(page).toHaveURL(/\/cl\/order\/confirmed\//, { timeout: 30_000 })

        await page.goBack()
        await page.reload()

        await expect(page.getByTestId("submit-order-button")).toHaveCount(0)
    })
})

// ─────────────────────────────────────────────────────────────
// 5. Reglas del MVP aún no implementadas
// ─────────────────────────────────────────────────────────────
test.describe("reglas del MVP (pendientes)", () => {
    // Cupo mensual (pedido que supera el saldo, dos compras a la vez):
    // cubierto en backend/integration-tests/http/benefit-budget/checkout-scenarios.spec.ts.
    test.fixme("cupo por día y site: una fecha llena deja de ofrecerse", async () => { })
    test.fixme("stock por site: la última unidad comprada a la vez solo la obtiene uno", async () => { })
})
