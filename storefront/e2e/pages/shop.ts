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

    /** Paso actual del checkout según la URL (?step=...). */
    currentStep(): string | null {
        return new URL(this.page.url()).searchParams.get("step")
    }

    /**
     * Recorre los pasos del checkout guiándose por ?step= hasta que el botón
     * de pedido quede habilitado: dirección → facturación → entrega → contacto → pago.
     * Depende de que en dev existan shipping options y un medio de pago
     * configurados para la región.
     */
    async completeSteps() {
        const p = this.page

        for (let i = 0; i < 8; i++) {
            if (await this.placeOrder.isEnabled().catch(() => false)) break

            const step = this.currentStep()
            switch (step) {
                // Hoy SIEMPRE se abre este paso: ver bug en Summary.handleConfirm
                // (checkoutPath se calcula antes de guardar la dirección del site).
                // La dirección del site no trae teléfono ni código postal, que el
                // formulario exige: se completan con valores de prueba.
                case "shipping-address": {
                    const required: [string, string][] = [
                        ["shipping-phone-input", "+56900000000"],
                        ["shipping-postal-code-input", "7630000"],
                    ]
                    for (const [id, value] of required) {
                        const input = p.getByTestId(id)
                        if (!(await input.inputValue())) await input.fill(value)
                    }
                    await p.getByTestId("submit-address-button").first().click()
                    break
                }
                case "billing-address":
                case "contact-details":
                    await p.getByTestId("submit-address-button").first().click()
                    break
                case "delivery":
                    await p.getByTestId("delivery-option-radio").first().click()
                    await p.getByTestId("submit-delivery-option-button").click()
                    break
                case "payment": {
                    const option = p.getByRole("radio").last()
                    if (await option.isVisible().catch(() => false)) await option.click()
                    await p.getByTestId("submit-payment-button").click()
                    break
                }
                default:
                    // Incluye "contact-information": getCheckoutStep lo devuelve, pero
                    // el componente de contacto solo se abre con "contact-details".
                    throw new Error(`Paso de checkout sin formulario que completar: ${step}`)
            }

            // Espera a que el checkout avance al siguiente paso (o habilite el botón).
            await expect
                .poll(async () => this.currentStep() !== step || (await this.placeOrder.isEnabled().catch(() => false)), { timeout: 30_000 })
                .toBe(true)
        }

        await expect(this.placeOrder).toBeEnabled({ timeout: 30_000 })
    }
}
