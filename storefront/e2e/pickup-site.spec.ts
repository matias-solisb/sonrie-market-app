import { expect, test, type Page } from "@playwright/test"
import { AUTH_FILE } from "./constants"
import { CartPage, StorePage } from "./pages/shop"

/*
Selección del site de retiro en el carrito ("Seleccione las opciones de entrega").

Cómo funciona hoy (modules/cart/templates/index.tsx y summary.tsx):
- El selector lista los Stock Locations de /store/stock-locations y arranca
  SIEMPRE en el primero de la lista (useState(stockLocations[0])).
- Al presionar "Confirmar pedido", Summary guarda la dirección del site elegido
  como shipping/billing address del carrito y su id en cart.metadata.

Los tests que cambian de site necesitan al menos 2 Stock Locations con
dirección en dev; si hay uno solo, se saltan.
*/

test.use({ storageState: AUTH_FILE })
test.describe.configure({ timeout: 120_000 })

test.beforeEach(async ({ page }) => {
    // Cada test parte sin carrito: el primer "Agregar" crea uno nuevo.
    await page.context().clearCookies({ name: "_medusa_cart_id" })
})

/** Agrega el primer producto del catálogo y abre el carrito. */
async function cartWithOneItem(page: Page) {
    const store = new StorePage(page)
    await store.goto()
    await store.addFirstProduct()
    const cart = new CartPage(page)
    await cart.goto()
    await expect(cart.quantityControl).toHaveCount(1)
    return cart
}

function siteSelect(page: Page) {
    return page.getByRole("combobox", { name: "Dirección" })
}

/** Abre el selector y devuelve las opciones visibles. */
async function openSites(page: Page) {
    await siteSelect(page).click()
    const options = page.getByRole("listbox").getByRole("option")
    await expect(options.first()).toBeVisible()
    return options
}

/** Elige el site en la posición `index` y devuelve su texto ("Dirección, Comuna"). */
async function chooseSite(page: Page, index: number) {
    const options = await openSites(page)
    const label = ((await options.nth(index).textContent()) ?? "").trim()
    await options.nth(index).click()
    await expect(siteSelect(page)).toHaveText(label)
    return label
}

/** Primera parte del texto del selector: la calle (address_1). */
function streetOf(label: string) {
    return label.split(",")[0].trim()
}

test("el selector muestra los sites y arranca con uno seleccionado", async ({ page }) => {
    await cartWithOneItem(page)

    await expect(siteSelect(page)).toBeEnabled()
    await expect(siteSelect(page)).not.toHaveText("")

    const options = await openSites(page)
    expect(await options.count()).toBeGreaterThanOrEqual(1)
})

test("cambiar de site actualiza la selección", async ({ page }) => {
    await cartWithOneItem(page)
    const options = await openSites(page)
    const total = await options.count()
    await page.keyboard.press("Escape")
    test.skip(total < 2, "Se necesitan al menos 2 sites (Stock Locations) en dev")

    const first = ((await siteSelect(page).textContent()) ?? "").trim()
    const second = await chooseSite(page, 1)

    expect(second).not.toBe(first)
})

test("el checkout usa la dirección del site elegido, no la del primero", async ({ page }) => {
    const cart = await cartWithOneItem(page)
    const options = await openSites(page)
    const total = await options.count()
    await page.keyboard.press("Escape")
    test.skip(total < 2, "Se necesitan al menos 2 sites (Stock Locations) en dev")

    const chosen = await chooseSite(page, 1)
    await cart.checkoutButton.click()
    await expect(page).toHaveURL(/\/cl\/checkout/, { timeout: 30_000 })

    // Hoy el checkout abre en el formulario de dirección (bug en Summary.handleConfirm);
    // si ya está corregido, la dirección aparece en el resumen del paso.
    const addressInput = page.getByTestId("shipping-address-input")
    if (await addressInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await expect(addressInput).toHaveValue(streetOf(chosen))
    } else {
        await expect(page.getByTestId("shipping-address-summary")).toContainText(streetOf(chosen))
    }
})

// BUG probable: el site elegido vive solo en el estado de la página
// (useState(stockLocations[0])). Si el colaborador elige otro site, confirma,
// y vuelve al carrito, el selector regresa al primero de la lista aunque
// cart.metadata.stock_location_id guarde el elegido. Si vuelve a confirmar sin
// mirar, el pedido sale para el site equivocado. Cuando se corrija, este test
// empieza a pasar y Playwright avisa que hay que quitar el test.fail().
test("al volver al carrito, el selector conserva el site elegido", async ({ page }) => {
    const cart = await cartWithOneItem(page)
    const options = await openSites(page)
    const total = await options.count()
    await page.keyboard.press("Escape")
    test.skip(total < 2, "Se necesitan al menos 2 sites (Stock Locations) en dev")

    test.fail()
    const chosen = await chooseSite(page, 1)
    await cart.checkoutButton.click()
    await expect(page).toHaveURL(/\/cl\/checkout/, { timeout: 30_000 })

    await cart.goto()

    await expect(siteSelect(page)).toHaveText(chosen, { timeout: 5_000 })
})
