import { assertEnv, checkEnv, cliCommand, DEVELOP_FLAG } from "../env-validation";

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const STRONG_A = "a".repeat(48);
const STRONG_B = "b".repeat(48);
const STRONG_C = "c".repeat(48);

const prodEnv = (overrides: Record<string, string | undefined> = {}) =>
  ({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://db",
    STORE_CORS: "https://tienda",
    ADMIN_CORS: "https://admin",
    AUTH_CORS: "https://tienda,https://admin",
    JWT_SECRET: STRONG_A,
    COOKIE_SECRET: STRONG_B,
    AUDIT_HASH_SECRET: STRONG_C,
    ...overrides,
  }) as NodeJS.ProcessEnv;

describe("checkEnv en producción", () => {
  it("una configuración completa no tiene errores ni advertencias", () => {
    expect(checkEnv(prodEnv(), "start")).toEqual({ errors: [], warnings: [] });
  });

  it.each([
    ["JWT_SECRET", undefined, /JWT_SECRET no está definido/],
    ["JWT_SECRET", "supersecret", /JWT_SECRET usa un valor de ejemplo/],
    ["JWT_SECRET", "corto", /JWT_SECRET tiene menos de 32/],
    ["COOKIE_SECRET", "", /COOKIE_SECRET no está definido/],
    ["COOKIE_SECRET", "SuperSecret", /COOKIE_SECRET usa un valor de ejemplo/],
    ["AUDIT_HASH_SECRET", undefined, /AUDIT_HASH_SECRET no está definido/],
    ["AUDIT_HASH_SECRET", "x".repeat(31), /AUDIT_HASH_SECRET tiene menos de 32/],
    ["DATABASE_URL", undefined, /DATABASE_URL no está definido/],
    ["STORE_CORS", " ", /STORE_CORS no está definido/],
    ["ADMIN_CORS", undefined, /ADMIN_CORS no está definido/],
    ["AUTH_CORS", undefined, /AUTH_CORS no está definido/],
  ])("%s=%p es error", (name, value, message) => {
    const { errors } = checkEnv(prodEnv({ [name]: value }), "start");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(message);
  });

  it("assertEnv lanza con todos los errores juntos", () => {
    expect(() =>
      assertEnv(prodEnv({ JWT_SECRET: "supersecret", COOKIE_SECRET: undefined }), "start")
    ).toThrow(/JWT_SECRET[\s\S]*COOKIE_SECRET/);
  });

  it("secretos iguales es advertencia, no error", () => {
    const { errors, warnings } = checkEnv(prodEnv({ COOKIE_SECRET: STRONG_A }), "start");
    expect(errors).toEqual([]);
    expect(warnings[0]).toMatch(/son iguales/);
  });

  it("medusa build no exige secretos (solo advierte)", () => {
    const { errors, warnings } = checkEnv(
      prodEnv({ JWT_SECRET: undefined, AUDIT_HASH_SECRET: undefined }),
      "build"
    );
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(2);
  });
});

describe("checkEnv fuera de producción", () => {
  it("los secretos de ejemplo son advertencia en desarrollo", () => {
    const env = prodEnv({
      NODE_ENV: "development",
      JWT_SECRET: "supersecret",
      COOKIE_SECRET: "supersecret",
      AUDIT_HASH_SECRET: undefined,
    });
    const { errors, warnings } = checkEnv(env, "develop");
    expect(errors).toEqual([]);
    // JWT, COOKIE e iguales; AUDIT_HASH_SECRET no se exige en desarrollo
    expect(warnings).toHaveLength(3);
    expect(() => assertEnv(env, "develop")).not.toThrow();
  });

  it("advierte si NODE_ENV no está definido", () => {
    const { errors, warnings } = checkEnv(prodEnv({ NODE_ENV: undefined }), "start");
    expect(errors).toEqual([]);
    expect(warnings.some((w) => /NODE_ENV no está definido/.test(w))).toBe(true);
  });

  it("advierte si medusa start corre con NODE_ENV distinto de production", () => {
    const { warnings } = checkEnv(prodEnv({ NODE_ENV: "qa" }), "start");
    expect(warnings.some((w) => /NODE_ENV="qa"/.test(w))).toBe(true);
  });
});

describe("medusa develop", () => {
  it("valida una sola vez: el start hijo de develop no repite ni da falso positivo", () => {
    const env = prodEnv({ NODE_ENV: "development", JWT_SECRET: "supersecret" });
    const warn = console.warn as jest.Mock;

    assertEnv(env, "develop");
    expect(env[DEVELOP_FLAG]).toBe("true");
    const parentWarnings = warn.mock.calls.length;
    expect(parentWarnings).toBe(1);

    assertEnv(env, "start");
    expect(warn.mock.calls.length).toBe(parentWarnings);
  });

  it("un start normal sí advierte NODE_ENV distinto de production", () => {
    assertEnv(prodEnv({ NODE_ENV: "development" }), "start");
    const messages = (console.warn as jest.Mock).mock.calls.map((c) => c[0]);
    expect(messages.some((m: string) => /medusa start/.test(m))).toBe(true);
  });
});

describe("cliCommand", () => {
  it("toma el primer argumento que no es opción", () => {
    expect(cliCommand(["node", "medusa", "start"])).toBe("start");
    expect(cliCommand(["node", "medusa", "--verbose", "build"])).toBe("build");
    expect(cliCommand(["node", "jest"])).toBeUndefined();
  });
});
