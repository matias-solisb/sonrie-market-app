import {
  IAuthModuleService,
  IUserModuleService,
} from "@medusajs/framework/types";
import { MedusaContainer } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { computeRutDv, initialPasswordFromRut } from "../../src/utils/rut";
import { ensureSonrieCompany } from "../../src/utils/sonrie-company";
import { createColaboradorWorkflow } from "../../src/workflows/colaborador/workflows";
import jwt from "jsonwebtoken";
import Scrypt from "scrypt-kdf";

export const adminHeaders = {
  headers: {},
};

export const createAdminUser = async (adminHeaders, appContainer) => {
  const userModule: IUserModuleService = appContainer.resolve(Modules.USER);
  const authModule: IAuthModuleService = appContainer.resolve(Modules.AUTH);
  const user = await userModule.createUsers({
    first_name: "Admin",
    last_name: "User",
    email: "admin@medusa.js",
  });

  const hashConfig = { logN: 15, r: 8, p: 1 };
  const passwordHash = await Scrypt.kdf("somepassword", hashConfig);

  const authIdentity = await authModule.createAuthIdentities({
    provider_identities: [
      {
        provider: "emailpass",
        entity_id: "admin@medusa.js",
        provider_metadata: {
          password: passwordHash.toString("base64"),
        },
      },
    ],
    app_metadata: {
      user_id: user.id,
    },
  });

  const token = jwt.sign(
    {
      actor_id: user.id,
      actor_type: "user",
      auth_identity_id: authIdentity.id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );

  adminHeaders.headers["authorization"] = `Bearer ${token}`;

  return { user, authIdentity };
};

/**
 * RUT válido y estable derivado de un texto (p. ej. el correo): el mismo
 * correo da siempre el mismo RUT y correos distintos dan RUTs distintos.
 */
export const rutDePrueba = (seed: string) => {
  let h = 0;
  for (const c of seed) {
    h = (h * 31 + c.charCodeAt(0)) % 9_000_000;
  }
  const body = String(10_000_000 + h);
  return `${body}-${computeRutDv(body)}`;
};

/*

Colaboradores de prueba. El autorregistro por API está cerrado
(src/api/middlewares/self-signup-disabled.ts), así que se crean igual que en
producción: con el workflow `create-colaborador`, como employees de la
company única. Después se loguean por la ruta normal (POST
/auth/customer/rut) con la clave inicial.

*/
export const createColaboradorSession = async ({
  api,
  container,
  email,
  rut = rutDePrueba(email),
  first_name = "Test",
  last_name = "User",
}: {
  api: any;
  container: MedusaContainer;
  email: string;
  rut?: string;
  first_name?: string;
  last_name?: string;
}) => {
  const { company } = await ensureSonrieCompany(container);
  const { result } = await createColaboradorWorkflow(container).run({
    input: { company_id: company.id, rut, email, first_name, last_name },
  });

  const password = initialPasswordFromRut(rut);
  const token = (await api.post("/auth/customer/rut", { rut, password })).data
    .token;

  return {
    customer: result.customer,
    employee: result.employee,
    token,
    rut,
    password,
  };
};

export const createStoreUser = async ({
  api,
  container,
}: {
  api: any;
  storeHeaders?: any;
  container: MedusaContainer;
}) => {
  const { customer, token } = await createColaboradorSession({
    api,
    container,
    email: "test@email.com",
  });

  return { customer, token };
};
