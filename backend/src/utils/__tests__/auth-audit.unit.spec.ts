import { auditAuth, clientIp, colaboradorRef, rutRef } from "../auth-audit"

/*
Auditoría de acceso (rut-auth, paso 10) — npm run test:unit.
*/

const SECRET_A = "a".repeat(32)
const SECRET_B = "b".repeat(32)

const withEnv = <T>(vars: Record<string, string | undefined>, run: () => T): T => {
  const before: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(vars)) {
    before[k] = process.env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    return run()
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

const fakeLogger = () => ({ info: jest.fn(), error: jest.fn() }) as any

describe("rutRef", () => {
  it("es estable, de 24 hex y no contiene el RUT", () => {
    withEnv({ AUDIT_HASH_SECRET: SECRET_A }, () => {
      const ref = rutRef("12345678-5")
      expect(ref).toMatch(/^[0-9a-f]{24}$/)
      expect(rutRef("12345678-5")).toBe(ref)
      expect(ref).not.toContain("12345678")
    })
  })

  it("RUTs distintos dan refs distintos", () => {
    withEnv({ AUDIT_HASH_SECRET: SECRET_A }, () => {
      expect(rutRef("12345678-5")).not.toBe(rutRef("11111111-1"))
    })
  })

  it("depende del secreto: sin él no se puede recalcular", () => {
    const a = withEnv({ AUDIT_HASH_SECRET: SECRET_A }, () => rutRef("12345678-5"))
    const b = withEnv({ AUDIT_HASH_SECRET: SECRET_B }, () => rutRef("12345678-5"))
    expect(a).not.toBe(b)
  })

  it("fuera de producción, sin secreto, usa el de desarrollo", () => {
    withEnv({ AUDIT_HASH_SECRET: undefined, NODE_ENV: "test" }, () => {
      expect(rutRef("12345678-5")).toMatch(/^[0-9a-f]{24}$/)
    })
  })

  it("en producción, sin secreto válido, devuelve null y avisa UNA vez", () => {
    jest.isolateModules(() => {
      const { rutRef: freshRutRef } = require("../auth-audit")
      const logger = fakeLogger()
      withEnv({ AUDIT_HASH_SECRET: "corto", NODE_ENV: "production" }, () => {
        expect(freshRutRef("12345678-5", logger)).toBeNull()
        expect(freshRutRef("11111111-1", logger)).toBeNull()
      })
      expect(logger.error).toHaveBeenCalledTimes(1)
    })
  })
})

describe("clientIp", () => {
  it("sin X-Forwarded-For → null", () => {
    expect(clientIp({})).toEqual({ ip: null, ip_cadena: null })
    expect(clientIp(undefined)).toEqual({ ip: null, ip_cadena: null })
  })

  it("con 0 proxies de confianza toma la primera IP", () => {
    withEnv({ AUDIT_TRUSTED_PROXY_HOPS: undefined }, () => {
      expect(clientIp({ "x-forwarded-for": "1.1.1.1, 10.0.0.1" })).toEqual({
        ip: "1.1.1.1",
        ip_cadena: "1.1.1.1, 10.0.0.1",
      })
    })
  })

  it("con N proxies toma la N-ésima desde la derecha (ignora lo que inventó el cliente)", () => {
    withEnv({ AUDIT_TRUSTED_PROXY_HOPS: "2" }, () => {
      const { ip } = clientIp({
        "x-forwarded-for": "6.6.6.6, 200.1.2.3, 10.0.0.1",
      })
      expect(ip).toBe("200.1.2.3")
    })
  })

  it("con más proxies que entradas, toma la primera", () => {
    withEnv({ AUDIT_TRUSTED_PROXY_HOPS: "5" }, () => {
      expect(clientIp({ "x-forwarded-for": "200.1.2.3" }).ip).toBe("200.1.2.3")
    })
  })

  it("recorta una cadena enorme", () => {
    const { ip_cadena } = clientIp({ "x-forwarded-for": "1.1.1.1,".repeat(100) })
    expect(ip_cadena!.length).toBeLessThanOrEqual(200)
  })
})

describe("auditAuth", () => {
  it("escribe una línea JSON con evento, fecha y sin campos undefined", () => {
    const logger = fakeLogger()
    auditAuth(logger, "auth.login_ok", { customer_id: "cus_1", ip: null, nada: undefined })

    const entry = JSON.parse(logger.info.mock.calls[0][0])
    expect(entry).toEqual({
      evento: "auth.login_ok",
      fecha_hora: expect.any(String),
      customer_id: "cus_1",
      ip: null,
    })
    expect(new Date(entry.fecha_hora).toISOString()).toBe(entry.fecha_hora)
  })

  it("nunca lanza, aunque falle el logger", () => {
    const logger = {
      info: () => {
        throw new Error("x")
      },
    } as any
    expect(() => auditAuth(logger, "auth.login_ok", {})).not.toThrow()
  })
})

describe("colaboradorRef", () => {
  it("con customer_id, solo customer_id", () => {
    expect(colaboradorRef("cus_1", "12345678-5")).toEqual({ customer_id: "cus_1" })
  })

  it("sin customer_id, rut_ref", () => {
    withEnv({ AUDIT_HASH_SECRET: SECRET_A }, () => {
      expect(colaboradorRef(null, "12345678-5")).toEqual({
        customer_id: null,
        rut_ref: rutRef("12345678-5"),
      })
    })
  })
})
