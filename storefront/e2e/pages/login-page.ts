import { expect, type Locator, type Page } from "@playwright/test"

export class LoginPage {
    readonly page: Page
    readonly form: Locator
    readonly email: Locator
    readonly password: Locator
    readonly submit: Locator
    readonly serverError: Locator
    readonly togglePassword: Locator
    readonly forgotPassword: Locator

    constructor(page: Page) {
        this.page = page
        this.form = page.getByTestId("login-page")
        this.email = page.getByTestId("email-input")
        this.password = page.getByTestId("password-input")
        this.submit = page.getByTestId("sign-in-button")
        // Snackbar/Alert de MUI que muestra el mensaje devuelto por el server action
        this.serverError = page.getByTestId("login-error-message")
        this.togglePassword = page.getByRole("button", {
            name: /(mostrar|ocultar) contraseña/i,
        })
        this.forgotPassword = page.getByTestId("forgot-password-link")
    }

    async goto(redirectTo?: string) {
        const url = redirectTo
            ? `/cl/account?redirect_to=${encodeURIComponent(redirectTo)}`
            : "/cl/account"
        await this.page.goto(url)
        await expect(this.form).toBeVisible()
    }

    async login(email: string, password: string) {
        await this.email.fill(email)
        await this.password.fill(password)
        await this.submit.click()
    }

    /** Mensaje de error de zod bajo un campo (helperText de MUI). */
    fieldError(text: string) {
        return this.page.getByText(text, { exact: true })
    }
}