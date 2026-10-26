import { expect, test } from "@playwright/test"
import { getSafeRedirect } from "../src/lib/util/safe-redirect"

// Test puro (sin navegador ni backend): proyecto "unit" de playwright.config.ts.
//   npx playwright test --project=unit
// Vulnerabilidad #5 (docs/vulnerabilidades.md): open redirect post-login.

// Cómo resuelve el navegador un Location relativo: si sale del origen, es
// un open redirect. Se usa para comprobar que los casos "malos" de verdad
// son peligrosos sin el filtro.
const leavesSite = (location: string) =>
    new URL(location, "https://tienda.example").origin !== "https://tienda.example"

test.describe("getSafeRedirect", () => {
    const evil = [
        "/\\evil.com",
        "/\\/evil.com",
        "\\\\evil.com",
        "/\t/evil.com",
        "/\n/evil.com",
        "/\r\n/evil.com",
        "//evil.com",
        "///evil.com",
        "https://evil.com",
        "http:evil.com",
        "javascript:alert(1)",
        "evil.com",
    ]

    for (const value of evil) {
        test(`rechaza ${JSON.stringify(value)}`, () => {
            expect(getSafeRedirect(value)).toBeNull()
        })
    }

    test("los casos con \\ y tab realmente salen del sitio sin filtro", () => {
        for (const value of ["/\\evil.com", "/\t/evil.com", "//evil.com"]) {
            expect(leavesSite(value)).toBe(true)
        }
    })

    test("rechaza valores vacíos, no-string y demasiado largos", () => {
        expect(getSafeRedirect(null)).toBeNull()
        expect(getSafeRedirect("")).toBeNull()
        expect(getSafeRedirect(undefined)).toBeNull()
        expect(getSafeRedirect({ name: "x" })).toBeNull()
        expect(getSafeRedirect("/" + "a".repeat(2048))).toBeNull()
    })

    const valid: [string, string][] = [
        ["/cl", "/cl"],
        ["/cl/store", "/cl/store"],
        ["/cl/checkout?step=delivery", "/cl/checkout?step=delivery"],
        ["/cl/products?q=leche#top", "/cl/products?q=leche#top"],
        ["/cl/../cl/account", "/cl/account"],
        ["/%09/evil.com", "/%09/evil.com"],
    ]

    for (const [value, expected] of valid) {
        test(`acepta ${value} → ${expected}`, () => {
            const result = getSafeRedirect(value)
            expect(result).toBe(expected)
            expect(leavesSite(result!)).toBe(false)
        })
    }
})
