import { expect, type APIRequestContext, type Page } from "@playwright/test"

/*
Acceso al backend como usuario del Admin, para preparar escenarios que el
colaborador no puede provocar desde el storefront (cerrar un día, dejar un
día sin cupos) y para los tests de la página "Agenda de retiro".

Requiere en .env.e2e:
  E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD   usuario del Admin de dev
  E2E_BACKEND_URL                        opcional, por defecto http://localhost:9000
Sin esas variables, los tests que lo usan se saltan solos.

Todo lo que un test cambia en la agenda lo tiene que deshacer con
`AgendaCleanup` (en afterEach): la agenda es compartida por todos los tests
y por quien use el ambiente. No usar `finally`: si el test se pasa del
tiempo, Playwright cierra el `request` antes de que corra.
*/
export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:9000"
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
export const hasAdmin = !!(ADMIN_EMAIL && ADMIN_PASSWORD)

const PICKUP = "/admin/pickup-scheduling"

export class AdminApi {
    private constructor(
        private readonly request: APIRequestContext,
        private readonly token: string
    ) { }

    static async login(request: APIRequestContext) {
        const res = await request.post(`${BACKEND_URL}/auth/user/emailpass`, {
            data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        })
        expect(res.ok(), "No se pudo iniciar sesión en el Admin (E2E_ADMIN_*)").toBeTruthy()
        return new AdminApi(request, (await res.json()).token)
    }

    private headers() {
        return { Authorization: `Bearer ${this.token}` }
    }

    async get<T = any>(path: string): Promise<T> {
        const res = await this.request.get(`${BACKEND_URL}${path}`, { headers: this.headers() })
        expect(res.ok(), `GET ${path}: ${res.status()}`).toBeTruthy()
        return res.json()
    }

    async post<T = any>(path: string, data: unknown): Promise<T> {
        const res = await this.request.post(`${BACKEND_URL}${path}`, {
            headers: this.headers(),
            data,
        })
        expect(res.ok(), `POST ${path}: ${res.status()} ${await res.text()}`).toBeTruthy()
        return res.json()
    }

    async delete(path: string) {
        await this.request.delete(`${BACKEND_URL}${path}`, { headers: this.headers() })
    }

    /** Sites de retiro con su configuración. */
    async pickupSites(): Promise<{ id: string; name: string; config: any }[]> {
        return (await this.get(`${PICKUP}/sites`)).sites
    }

    async siteIdByName(name: string) {
        const site = (await this.pickupSites()).find((s) => s.name === name.trim())
        expect(site, `No hay un site de retiro llamado "${name}"`).toBeTruthy()
        return site!.id
    }

    /** Crea una excepción y devuelve su id (borrarla con deleteException). */
    async createException(body: {
        fecha: string
        stock_location_id?: string | null
        tipo: "feriado" | "cerrado" | "abierto"
        capacidad?: number | null
        motivo?: string | null
    }): Promise<string> {
        return (await this.post(`${PICKUP}/exceptions`, body)).exception.id
    }

    async deleteException(id: string) {
        await this.delete(`${PICKUP}/exceptions/${id}`)
    }

    /** Excepciones (globales y de sites) de una fecha. */
    async exceptionsOn(fecha: string): Promise<any[]> {
        return (await this.get(`${PICKUP}/exceptions?desde=${fecha}&hasta=${fecha}`)).exceptions
    }

    /** Borra las excepciones de esa fecha con ese motivo. */
    async deleteExceptionsByMotivo(fecha: string, motivo: string) {
        for (const e of (await this.exceptionsOn(fecha)).filter((x) => x.motivo === motivo)) {
            await this.deleteException(e.id)
        }
    }

    /** Primera fecha desde `desde` días adelante sin ninguna excepción. */
    async freeDate(desde: number) {
        for (let d = desde; d < desde + 60; d++) {
            const fecha = fechaChile(d)
            if (!(await this.exceptionsOn(fecha)).length) return fecha
        }
        throw new Error("No hay una fecha libre de excepciones")
    }

    /** Configuración propia del site (null = hereda la general). */
    async siteConfig(id: string) {
        return (await this.pickupSites()).find((s) => s.id === id)?.config ?? null
    }

    async updateSite(id: string, body: Record<string, number | null>) {
        await this.post(`${PICKUP}/sites/${id}`, body)
    }
}

/**
 * Deshacer cambios de la agenda después de cada test:
 *
 *   const cleanup = new AgendaCleanup()
 *   test.afterEach(({ request }) => cleanup.run(request))
 *   ...
 *   cleanup.add((admin) => admin.deleteException(id))
 *
 * afterEach corre también cuando el test falla o se pasa del tiempo.
 */
export class AgendaCleanup {
    private tasks: ((admin: AdminApi) => Promise<unknown>)[] = []

    add(task: (admin: AdminApi) => Promise<unknown>) {
        this.tasks.push(task)
    }

    async run(request: APIRequestContext) {
        const tasks = this.tasks.splice(0)
        if (!tasks.length) return

        const admin = await AdminApi.login(request)
        for (const task of tasks.reverse()) {
            await task(admin).catch((e) => console.warn("Limpieza de la agenda falló:", e))
        }
    }
}

/** Inicia sesión en la UI del Admin (/app). */
export async function loginAdminUi(page: Page) {
    await page.goto(`${BACKEND_URL}/app/login`)
    await page.locator('input[name="email"]').fill(ADMIN_EMAIL!)
    await page.locator('input[name="password"]').fill(ADMIN_PASSWORD!)
    await page.getByRole("button", { name: /continue|continuar|iniciar/i }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 })
}

/** Fecha de calendario de Chile, `dias` días desde hoy ("YYYY-MM-DD"). */
export function fechaChile(dias = 0) {
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date())
    const d = new Date(`${hoy}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + dias)
    return d.toISOString().slice(0, 10)
}
