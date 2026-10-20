import { expect, type Locator, type Page } from "@playwright/test"

/** Paso 1: /cl/recover-password (modules/account/components/recover-password) */
export class RecoverPasswordPage {
  readonly page: Page
  readonly card: Locator
  readonly rut: Locator
  readonly submit: Locator
  readonly serverError: Locator
  readonly backToLogin: Locator

  constructor(page: Page) {
    this.page = page
    this.card = page.getByTestId("recover-password-page")
    this.rut = page.getByTestId("recover-password-rut-input")
    this.submit = page.getByTestId("recover-password-submit-button")
    this.serverError = page.getByTestId("recover-password-error-message")
    this.backToLogin = page.getByTestId("back-to-login-link")
  }

  async goto() {
    await this.page.goto("/cl/recover-password")
    await expect(this.card).toBeVisible()
  }

  async request(rut: string) {
    await this.rut.fill(rut)
    await this.submit.click()
  }

  /** Mensaje de éxito (idéntico exista o no la cuenta). */
  successMessage() {
    return this.page.getByText("Si el RUT que ingresaste está registrado")
  }

  fieldError(text: string) {
    return this.page.getByText(text, { exact: true })
  }
}
