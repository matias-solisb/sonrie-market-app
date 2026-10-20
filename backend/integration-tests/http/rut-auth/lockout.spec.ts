import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { IAuthModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  INVALID_CREDENTIALS_MESSAGE,
  LOCKOUT,
} from "../../../src/modules/rut-auth/config";
import { registerAttempt } from "../../../src/modules/rut-auth/lockout";
import { CLAVE_COLABORADOR, createColaboradorSession } from "../../utils/admin";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";

jest.setTimeout(120 * 1000);

/*

Lockout y anti-enumeración (rut-auth, paso 7) — npm run test:integration:http.

Lockout (LOCKOUT de config.ts: N fallos seguidos → M minutos)
- N claves malas bloquean: el siguiente intento, AUN CON LA CLAVE CORRECTA,
  responde 401 con el mismo mensaje.
- Menos de N fallos y luego la clave correcta: entra y el contador vuelve a 0.
- Al vencer el bloqueo vuelve a entrar; un fallo después del vencimiento
  cuenta desde 1, no vuelve a bloquear de inmediato.
- En paralelo: 20 intentos malos simultáneos no pasan del límite.
- Cambio de clave: una clave actual equivocada suma intentos; bloqueado, ni la
  clave actual correcta sirve. Un cambio de clave (reset) desbloquea.

Anti-enumeración
- RUT inexistente, RUT inválido, clave incorrecta y cuenta bloqueada: mismo
  401, mismo mensaje y tiempos de respuesta comparables (mediana).

*/

const status = (p: Promise<any>) =>
  p.then((r) => r.status).catch((e) => e.response?.status);

const errorOf = (p: Promise<any>) =>
  p.then(
    () => null,
    (e) => e.response
  );

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    const auth = () => getContainer().resolve<IAuthModuleService>(Modules.AUTH);

    const colaborador = () =>
      createColaboradorSession({
        api,
        container: getContainer(),
        email: "juana.perez@sonriemarket.cl",
      });

    const login = (rut: string, password: string) =>
      status(api.post("/auth/customer/rut", { rut, password }));

    const fallar = async (rut: string, veces: number) => {
      for (let i = 0; i < veces; i++) {
        expect(await login(rut, "ClaveEquivocada")).toBe(401);
      }
    };

    const estado = async (rut: string) => {
      const [pi] = await auth().listProviderIdentities({ provider: "rut", entity_id: rut });
      return pi.provider_metadata as Record<string, any>;
    };

    /** Mueve locked_until al pasado (sin esperar los minutos del bloqueo). */
    const vencerBloqueo = async (rut: string) => {
      const pg = getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION);
      await pg.raw(
        `update provider_identity
            set provider_metadata = jsonb_set(provider_metadata, '{locked_until}',
                to_jsonb(to_char((now() - interval '1 minute') at time zone 'UTC',
                                 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
          where provider = 'rut' and entity_id = ?`,
        [rut]
      );
    };

    describe("lockout", () => {
      it(`${LOCKOUT.maxFailedAttempts} claves malas bloquean, aun con la clave correcta después`, async () => {
        const { rut } = await colaborador();

        await fallar(rut, LOCKOUT.maxFailedAttempts);

        const res = await errorOf(
          api.post("/auth/customer/rut", { rut, password: CLAVE_COLABORADOR })
        );
        expect(res.status).toBe(401);
        expect(res.data.message).toBe(INVALID_CREDENTIALS_MESSAGE);

        const s = await estado(rut);
        expect(s.failed_attempts).toBe(LOCKOUT.maxFailedAttempts);
        expect(new Date(s.locked_until).getTime()).toBeGreaterThan(Date.now());
      });

      it("el bloqueo dura lo configurado", async () => {
        const { rut } = await colaborador();
        const antes = Date.now();

        await fallar(rut, LOCKOUT.maxFailedAttempts);

        const hasta = new Date((await estado(rut)).locked_until).getTime();
        const minutos = (hasta - antes) / 60_000;
        expect(minutos).toBeGreaterThan(LOCKOUT.lockMinutes - 1);
        expect(minutos).toBeLessThanOrEqual(LOCKOUT.lockMinutes + 1);
      });

      it("menos fallos que el límite y luego la clave correcta: entra y el contador vuelve a 0", async () => {
        const { rut } = await colaborador();

        await fallar(rut, LOCKOUT.maxFailedAttempts - 1);
        expect((await estado(rut)).failed_attempts).toBe(LOCKOUT.maxFailedAttempts - 1);

        expect(await login(rut, CLAVE_COLABORADOR)).toBe(200);
        expect((await estado(rut)).failed_attempts).toBe(0);
      });

      it("al vencer el bloqueo vuelve a entrar", async () => {
        const { rut } = await colaborador();
        await fallar(rut, LOCKOUT.maxFailedAttempts);

        await vencerBloqueo(rut);

        expect(await login(rut, CLAVE_COLABORADOR)).toBe(200);
        const s = await estado(rut);
        expect(s.failed_attempts).toBe(0);
        expect(s.locked_until).toBeNull();
      });

      it("un fallo después del vencimiento cuenta desde 1", async () => {
        const { rut } = await colaborador();
        await fallar(rut, LOCKOUT.maxFailedAttempts);
        await vencerBloqueo(rut);

        await fallar(rut, 1);

        const s = await estado(rut);
        expect(s.failed_attempts).toBe(1);
        expect(s.locked_until).toBeNull();
        expect(await login(rut, CLAVE_COLABORADOR)).toBe(200);
      });

      it("20 intentos simultáneos: solo los primeros N quedan autorizados a verificar la clave", async () => {
        // Directo contra la base y en paralelo real (pool de conexiones): es
        // lo que decide cuántas claves puede probar un atacante que dispara
        // muchos intentos a la vez. Mirar solo el contador final no basta:
        // con una lectura-escritura no atómica el contador igual termina en
        // N, pero más de N intentos alcanzan a verificar la clave.
        const { rut } = await colaborador();
        const pg = getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION);

        const resultados = await Promise.all(
          Array.from({ length: 20 }, () => registerAttempt(pg as any, rut))
        );

        const autorizados = resultados.filter((r) => r.exists && !r.locked);
        expect(autorizados).toHaveLength(LOCKOUT.maxFailedAttempts);
        expect((await estado(rut)).failed_attempts).toBe(LOCKOUT.maxFailedAttempts);
      });

      it("20 intentos malos en paralelo por HTTP no pasan del límite", async () => {
        const { rut } = await colaborador();

        const codes = await Promise.all(
          Array.from({ length: 20 }, () => login(rut, "ClaveEquivocada"))
        );

        expect(codes.every((c) => c === 401)).toBe(true);
        expect((await estado(rut)).failed_attempts).toBe(LOCKOUT.maxFailedAttempts);
        expect(await login(rut, CLAVE_COLABORADOR)).toBe(401);
      });
    });

    describe("cambio de clave", () => {
      it("la clave actual equivocada suma intentos y bloquea; un reset desbloquea", async () => {
        const { rut, token } = await colaborador();
        const pk = generateStoreHeaders({
          publishableKey: await generatePublishableKey(getContainer()),
        }).headers;
        const headers = { headers: { ...pk, Authorization: `Bearer ${token}` } };
        const cambiar = (current_password: string) =>
          errorOf(
            api.post(
              "/store/customers/me/password",
              { current_password, password: "OtraClaveSegura" },
              headers
            )
          );

        for (let i = 0; i < LOCKOUT.maxFailedAttempts; i++) {
          expect((await cambiar("ClaveEquivocada")).status).toBe(400);
        }

        // Bloqueada: ni la clave actual correcta sirve, ni el login
        const res = await cambiar(CLAVE_COLABORADOR);
        expect(res.status).toBe(400);
        expect(res.data.code).toBe("invalid_current_password");
        expect(await login(rut, CLAVE_COLABORADOR)).toBe(401);

        // Un cambio de clave (como el reset por correo del paso 8) desbloquea
        const { success } = await auth().updateProvider("rut", {
          entity_id: rut,
          password: "ClaveDespuesDelReset",
        });
        expect(success).toBe(true);

        const s = await estado(rut);
        expect(s.failed_attempts).toBe(0);
        expect(s.locked_until).toBeNull();
        expect(await login(rut, "ClaveDespuesDelReset")).toBe(200);
      });
    });

    describe("anti-enumeración", () => {
      it("mismo 401 y mismo mensaje en todos los casos de falla", async () => {
        const { rut } = await colaborador();
        const bloqueado = await createColaboradorSession({
          api,
          container: getContainer(),
          email: "pedro@sonriemarket.cl",
        });
        await fallar(bloqueado.rut, LOCKOUT.maxFailedAttempts);

        const casos = [
          { rut: "11.111.111-1", password: "ClaveEquivocada" }, // inexistente
          { rut: "12.345.678-4", password: "ClaveEquivocada" }, // inválido
          { rut, password: "ClaveEquivocada" }, // clave incorrecta
          { rut: bloqueado.rut, password: CLAVE_COLABORADOR }, // bloqueado
        ];

        for (const body of casos) {
          const res = await errorOf(api.post("/auth/customer/rut", body));
          expect(res.status).toBe(401);
          expect(res.data).toEqual(
            expect.objectContaining({ message: INVALID_CREDENTIALS_MESSAGE })
          );
        }
      });

      it("los tiempos de respuesta son comparables (mediana)", async () => {
        const { rut } = await colaborador();
        const bloqueado = await createColaboradorSession({
          api,
          container: getContainer(),
          email: "pedro@sonriemarket.cl",
        });
        await fallar(bloqueado.rut, LOCKOUT.maxFailedAttempts);

        // Directo al Auth Module: mide el provider sin el ruido de HTTP.
        const medir = async (body: Record<string, string>) => {
          const tiempos: number[] = [];
          for (let i = 0; i < 7; i++) {
            const t0 = performance.now();
            await auth().authenticate("rut", { body } as any);
            tiempos.push(performance.now() - t0);
          }
          return median(tiempos);
        };

        // El RUT con clave incorrecta se mide con menos intentos que el
        // límite: en el 5.º quedaría bloqueado y mediría otro caso.
        const medirClaveIncorrecta = async () => {
          const tiempos: number[] = [];
          for (let i = 0; i < 7; i++) {
            const t0 = performance.now();
            await auth().authenticate("rut", { body: { rut, password: "ClaveEquivocada" } } as any);
            tiempos.push(performance.now() - t0);
            await auth().authenticate("rut", { body: { rut, password: CLAVE_COLABORADOR } } as any);
          }
          return median(tiempos);
        };

        const t = {
          inexistente: await medir({ rut: "11.111.111-1", password: "ClaveEquivocada" }),
          invalido: await medir({ rut: "12.345.678-4", password: "ClaveEquivocada" }),
          claveIncorrecta: await medirClaveIncorrecta(),
          bloqueado: await medir({ rut: bloqueado.rut, password: CLAVE_COLABORADOR }),
        };

        const valores = Object.values(t);
        const min = Math.min(...valores);
        const max = Math.max(...valores);

        // Para la evidencia del paso 11: medianas en ms por caso.
        console.info("[lockout.spec] tiempos (mediana, ms):", t);

        // Sin verificación argon2 en algún caso, la diferencia sería de dos o
        // tres órdenes de magnitud (< 1 ms contra ≈ 100 ms). Se tolera ruido.
        expect(max / min).toBeLessThan(1.6);
      });
    });
  },
});
