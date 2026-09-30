import { expect, type Locator, type Page } from "@playwright/test"

/** Paso 2: /cl/reset-password?token=... (modules/account/components/reset-password) */
export class ResetPasswordPage {
  readonly page: Page
  readonly card: Locator
  readonly password: Locator
  readonly repeatPassword: Locator
  readonly submit: Locator
  readonly serverError: Locator
  readonly backToLogin: Locator

  constructor(page: Page) {
    this.page = page
    this.card = page.getByTestId("reset-password-page")
    this.password = page.getByTestId("password-input")
    this.repeatPassword = page.getByTestId("repeat_password-input")
    this.submit = page.getByTestId("reset-password-submit-button")
    this.serverError = page.getByTestId("reset-password-error-message")
    this.backToLogin = page.getByTestId("back-to-login-link")
  }

  async goto(token?: string) {
    const url = token
      ? `/cl/reset-password?token=${encodeURIComponent(token)}`
      : "/cl/reset-password"
    await this.page.goto(url)
    await expect(this.card).toBeVisible()
  }

  async setPassword(password: string, repeat: string = password) {
    await this.password.fill(password)
    await this.repeatPassword.fill(repeat)
    await this.submit.click()
  }

  title(text: string) {
    return this.card.getByText(text, { exact: true })
  }

  fieldError(text: string) {
    return this.page.getByText(text, { exact: true })
  }
}
