import { defineConfig, devices } from "@playwright/test"

// Variables de los tests (usuario de prueba). Node 22 las lee sin dotenv.
// Si el archivo no existe, se sigue: los tests que lo necesitan se saltan solos.
try {
    process.loadEnvFile(".env.e2e")
} catch { }

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8000"

export default defineConfig({
    testDir: "./e2e",
    // Los tests de login comparten un mismo usuario. Cuando exista el lockout
    // de rut-auth, los intentos fallidos en paralelo podrían bloquearlo.
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: [["list"], ["html", { open: "never" }]],

    // `next dev` compila cada página la primera vez que se visita: da margen.
    timeout: 60_000,
    expect: { timeout: 10_000 },

    use: {
        baseURL: BASE_URL,
        locale: "es-CL",
        timezoneId: "America/Santiago",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },

    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

    // Levanta el storefront si no está corriendo. El BACKEND (Medusa en :9000)
    // tienes que levantarlo tú: el middleware lo necesita para resolver la región.
})