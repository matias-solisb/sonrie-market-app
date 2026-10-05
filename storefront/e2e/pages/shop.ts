import { expect, type Locator, type Page } from "@playwright/test"

/** "$12.990" → 12990 */
export function parseClp(text: string | null): number {
    return Number((text ?? "").replace(/\D/g, ""))
}

/** Catálogo /cl/store: tarjetas de producto con el botón Agregar / stepper. */
export class StorePage {
    constructor(readonly page: Page) { }

    async goto() {
        await this.page.goto("/cl/store")
        await expect(this.products.first()).toBeVisible({ timeout: 30_000 })
    }

    get products(): Locator {
        return this.page.getByTestId("product-wrapper")
    }

    /** Primer producto con botón "Agregar", fijado por su link (no cambia al agregarlo). */
    async firstAddable(): Promise<Locator> {
        const candidate = this.products
            .filter({ has: this.page.getByTestId("add-to-cart-button") })
            .first()
        const href = await candidate.getByRole("link").first().getAttribute("href")
        return this.products.filter({ has: this.page.locator(`a[href="${href}"]`) })
    }

    async addFirstProduct(): Promise<string> {
        const card = await this.firstAddable()
        const title = (await card.getByTestId("product-title").textContent())?.trim() ?? ""
        await card.getByTestId("add-to-cart-button").click()
        await expect(card.getByTestId("cart-quantity-value")).toHaveText("1", { timeout: 30_000 })
        return title
    }
}

/** Carrito /cl/cart */
export class CartPage {
    constructor(readonly page: Page) { }

    async goto() {
        await this.page.goto("/cl/cart")
        await expect(this.page.getByTestId("cart-container")).toBeVisible({ timeout: 30_000 })
    }

    get items() { return this.page.getByTestId("cart-items-container") }
    get quantityControl() { return this.page.getByTestId("cart-item-quantity").first() }
    get quantityInput() { return this.quantityControl.getByRole("textbox").or(this.quantityControl.getByRole("spinbutton")).first() }
    get plus() { return this.quantityControl.getByRole("button", { name: "Agregar una unidad" }) }
    get minus() { return this.quantityControl.getByRole("button", { name: "Quitar una unidad" }) }
    get removeButton() { return this.page.getByTestId("cart-item-remove-button").first() }
    get subtotal() { return this.page.getByTestId("cart-subtotal") }
    get checkoutButton() { return this.page.getByTestId("checkout-button") }
    get emptyMessage() { return this.page.getByTestId("empty-cart-message") }

    async subtotalValue() {
        return parseClp(await this.subtotal.textContent())
    }

    /** Escribe una cantidad en el input y confirma con Enter o con blur (Tab). */
    async typeQuantity(value: string, confirm: "Enter" | "Tab" = "Enter") {
        await this.quantityInput.fill(value)
        await this.quantityInput.press(confirm)
    }
}

/** Checkout /cl/checkout: recorre los pasos que estén abiertos. */
export class CheckoutPage {
    constructor(readonly page: Page) { }

    get placeOrder() { return this.page.getByTestId("submit-order-button") }
    get orderError() { return this.page.getByTestId("submit-order-error") }
    get pickupSiteName() { return this.page.getByTestId("pickup-site-name") }

    /**
     * El checkout es de una sola página: dirección, retiro, contacto y pago
     * ("Cargo beneficio") ya vienen resueltos desde el carrito. Solo espera a
     * que el botón "Confirmar pedido" esté habilitado.
     */
    async completeSteps() {
        await expect(this.placeOrder).toBeEnabled({ timeout: 30_000 })
    }
}
