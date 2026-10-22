import { expect, test } from "@playwright/test"
import {
    getMissingProfileFields,
    joinLabels,
} from "../src/lib/util/profile-completion"

/*

Regla de "perfil completo" (lib/util/profile-completion.ts). Es lógica pura:
corre sin navegador, pero va en Playwright porque el storefront no tiene
runner de tests unitarios.

*/
test.describe("getMissingProfileFields", () => {
    test("sin customer no falta nada (no hay a quién avisarle)", () => {
        expect(getMissingProfileFields(null)).toEqual([])
    })

    test("con correo y teléfono está completo", () => {
        expect(getMissingProfileFields({ email: "a@soprole.cl", phone: "+56912345678" })).toEqual([])
    })

    test("teléfono vacío, nulo o con espacios cuenta como faltante y es editable", () => {
        for (const phone of ["", null, "   ", undefined]) {
            expect(getMissingProfileFields({ email: "a@soprole.cl", phone })).toEqual([
                { field: "phone", label: "teléfono", editable: true },
            ])
        }
    })

    test("el correo faltante no es editable por el colaborador", () => {
        expect(getMissingProfileFields({ email: "", phone: "+56912345678" })).toEqual([
            { field: "email", label: "correo", editable: false },
        ])
    })

    test("no exige dirección de facturación (regla vieja del B2B Starter)", () => {
        const customer = { email: "a@soprole.cl", phone: "+56912345678", addresses: [] }
        expect(getMissingProfileFields(customer)).toEqual([])
    })
})

test.describe("joinLabels", () => {
    const f = (label: string) => ({ field: "phone" as const, label, editable: true })

    test("arma la frase en español", () => {
        expect(joinLabels([])).toBe("")
        expect(joinLabels([f("teléfono")])).toBe("teléfono")
        expect(joinLabels([f("correo"), f("teléfono")])).toBe("correo y teléfono")
        expect(joinLabels([f("a"), f("b"), f("c")])).toBe("a, b y c")
    })
})
