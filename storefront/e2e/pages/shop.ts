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

    /**
     * Producto con botón "Agregar" de menor precio en la página, fijado por su
     * link. Para los flujos de compra: el primero del catálogo puede costar más
     * que el cupo mensual (p. ej. un pack de $56.000 con tope de $50.000) y el
     * carrito queda bloqueado por "Saldo insuficiente". Si ninguna card
     * muestra precio, cae en el primero.
     */
    async cheapestAddable(): Promise<Locator> {
        const cards = this.products.filter({ has: this.page.getByTestId("add-to-cart-button") })
        const count = await cards.count()
        let cheapest: { href: string; price: number } | null = null

        for (let i = 0; i < count; i++) {
            const card = cards.nth(i)
            // allTextContents no espera: una card sin precio no bloquea el test
            const [priceText] = await card.getByTestId("price").allTextContents()
            const price = parseClp(priceText ?? null)
            const href = await card.getByRole("link").first().getAttribute("href")
            if (price > 0 && href && (!cheapest || price < cheapest.price)) {
                cheapest = { href, price }
            }
        }

        if (!cheapest) return this.firstAddable()
        return this.products.filter({ has: this.page.locator(`a[href="${cheapest.href}"]`) })
    }

    async addFirstProduct(): Promise<string> {
        return this.addProduct(await this.firstAddable())
    }

    /** Agrega el producto más barato con stock (ver cheapestAddable). */
    async addCheapestProduct(): Promise<string> {
        return this.addProduct(await this.cheapestAddable())
    }

    private async addProduct(card: Locator): Promise<string> {
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
    get disabledReason() { return this.page.getByTestId("submit-disabled-reason") }

    /** Botones de fecha de retiro (pickup-date-selector). */
    get dateOptions() { return this.page.getByTestId("pickup-date-option") }
    get availableDates() { return this.page.locator('[data-testid="pickup-date-option"][data-disponible="true"]') }
    get unavailableDates() { return this.page.locator('[data-testid="pickup-date-option"][data-disponible="false"]') }
    get selectedDate() { return this.page.getByTestId("pickup-date-selected") }
    /** Aviso de que la fecha guardada ya no sirve (se cerró, se llenó o ya pasó). */
    get invalidDate() { return this.page.getByTestId("pickup-date-invalid") }
    get dateError() { return this.page.getByTestId("pickup-date-error") }

    /** Fecha elegida (data-fecha del botón presionado), o null. */
    async chosenDate(): Promise<string | null> {
        const pressed = this.page.locator('[data-testid="pickup-date-option"][aria-pressed="true"]')
        return (await pressed.count()) ? pressed.first().getAttribute("data-fecha") : null
    }

    get savingDate() { return this.page.getByTestId("pickup-date-saving") }

    /**
     * Elige la primera fecha con cupo y espera a que el backend la guarde:
     * "Retiras el …" (pickup-date-selected) aparece recién cuando termina de
     * guardarse, no al hacer clic. Devuelve la fecha.
     */
    async chooseFirstDate(): Promise<string> {
        await expect(this.availableDates.first()).toBeVisible({ timeout: 30_000 })
        const option = this.availableDates.first()
        const fecha = (await option.getAttribute("data-fecha"))!
        await option.click()
        await expect(this.savingDate).toHaveCount(0, { timeout: 30_000 })
        await expect(this.selectedDate).toBeVisible({ timeout: 30_000 })
        await expect(option).toHaveAttribute("aria-pressed", "true")
        return fecha
    }

    /**
     * El checkout es de una sola página: dirección, retiro, contacto y pago
     * ("Cargo beneficio") ya vienen resueltos desde el carrito. Falta solo la
     * fecha de retiro: si no hay una elegida con cupo, elige la primera.
     * Después espera a que "Confirmar pedido" esté habilitado.
     */
    async completeSteps() {
        await expect(this.dateOptions.first()).toBeVisible({ timeout: 30_000 })
        if (!(await this.selectedDate.isVisible())) {
            await this.chooseFirstDate()
        }
        await expect(this.placeOrder).toBeEnabled({ timeout: 30_000 })
    }
}
