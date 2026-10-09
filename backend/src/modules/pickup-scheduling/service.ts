import { Context, Logger } from "@medusajs/framework/types";
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils";
import { EntityManager } from "@mikro-orm/knex";
import {
  DEFAULT_DIAS_ABIERTOS,
  DEFAULT_HORIZONTE_DIAS,
  DEFAULT_LEAD_TIME_DIAS,
  PICKUP_SETTING_KEY,
  PickupBooking,
  PickupOccupancy,
  PickupScheduleChange,
  PickupSetting,
  SiteSchedule,
  SiteScheduleException,
  SiteSlotConfig,
} from "./models";
import { FERIADOS_CHILE } from "./data/feriados-chile";
import {
  AvailableDate,
  BookingWindow,
  CreateExceptionInput,
  EstadoBooking,
  LoadHolidaysResult,
  UpdateExceptionInput,
  ReleaseBookingInput,
  ReleaseBookingResult,
  ReserveBookingInput,
  ReserveBookingResult,
  ResolvedDay,
  UpdatePickupSettingInput,
  UpsertSiteScheduleInput,
  UpsertSiteSlotConfigInput,
} from "./types";
import {
  addDays,
  diaSemana,
  eachFecha,
  formatFecha,
  isValidFecha,
  toFecha,
} from "./utils/fecha";

/*

Servicio del módulo pickup-scheduling (Documento técnico §7). MVP: cupo por
día y site, sin bloques horarios.

Además del CRUD que genera `MedusaService`, expone:

- Configuración (Admin), con auditoría en PickupScheduleChange:
    `getSettings` / `updateSettings`, `upsertSiteSlotConfig`,
    `upsertSiteSchedule` / `deleteSiteSchedule`,
    `createException` / `updateException` / `deleteException`,
    `loadHolidays` (feriados nacionales de Chile).
  Los métodos que escriben reciben `actorId` (usuario del Admin; null =
  script o sistema). Usar estos y no el CRUD genérico, que se salta las
  validaciones y la auditoría.
- Disponibilidad: `getWindow`, `resolveDays`, `listAvailableDates`,
  `listDays` (ocupación de un rango), `assertDateBookable` (valida sin
  reservar).
- Ciclo del cupo:
    `reserveBooking` / `revertBooking`   checkout y su compensación
    `confirmBooking`                     order.placed
    `releaseBookingByOrder` / `undoRelease`  order.canceled y su compensación

Resolución de un día (site, fecha). ¿Abre?, gana la primera regla que aplique:
  1. Feriado global irrenunciable → cerrado, sin excepción posible.
  2. Excepción del site para esa fecha.
  3. Excepción global para esa fecha.
  4. Horario semanal del site (SiteSchedule).
  5. PickupSetting.dias_abiertos_por_defecto.
¿Cuántos cupos?, el primer valor no nulo:
  1. Capacidad de la excepción "abierto" del site.
  2. Capacidad del día de la semana del site.
  3. SiteSlotConfig.capacidad_diaria.
  4. PickupSetting.capacidad_por_defecto.
Si ninguno tiene valor, el día queda abierto pero "sin configurar"
(capacidad null): no se ofrece y no se puede reservar.

Concurrencia: el cupo se toma con un UPDATE condicional
(`ocupados < capacidad`). Postgres bloquea la fila y vuelve a evaluar la
condición, así que dos checkouts simultáneos por el último cupo no pueden
pasar ambos, aunque corran en instancias distintas. Mismo patrón que
benefit-budget; no depende de locks en memoria ni en Redis.

*/

type Setting = {
  id: string;
  capacidad_por_defecto: number | null;
  lead_time_dias: number;
  horizonte_dias: number;
  dias_abiertos_por_defecto: number[];
};

type SiteRules = {
  setting: Setting;
  config: { capacidad_diaria: number | null } | null;
  horario: Map<number, { abierto: boolean; capacidad: number | null }>;
  excepcionesSite: Map<string, ExceptionRow>;
  excepcionesGlobales: Map<string, ExceptionRow>;
};

type ExceptionRow = {
  tipo: "feriado" | "cerrado" | "abierto";
  irrenunciable: boolean;
  capacidad: number | null;
  motivo: string | null;
};

type BookingRow = {
  id: string;
  cart_id: string;
  order_id: string | null;
  stock_location_id: string;
  fecha: string;
  estado: EstadoBooking;
};

const invalid = (message: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, message);

const notAllowed = (message: string) =>
  new MedusaError(MedusaError.Types.NOT_ALLOWED, message);

const assertNonNegativeInt = (value: unknown, campo: string) => {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw invalid(`${campo} debe ser un entero mayor o igual a 0.`);
  }
};

const assertOptionalNonNegativeInt = (value: unknown, campo: string) => {
  if (value !== undefined && value !== null) {
    assertNonNegativeInt(value, campo);
  }
};

const assertFecha = (fecha: unknown) => {
  if (!isValidFecha(fecha)) {
    throw invalid(`Fecha inválida: ${fecha}. Formato esperado: YYYY-MM-DD.`);
  }
};

const assertDiaSemana = (dia: unknown) => {
  if (!Number.isInteger(dia) || (dia as number) < 1 || (dia as number) > 7) {
    throw invalid(`Día de la semana inválido: ${dia}. Use 1 (lunes) a 7 (domingo).`);
  }
};

const firstNonNull = (...values: (number | null | undefined)[]) =>
  values.find((v) => v !== null && v !== undefined) ?? null;

type Cambios = Record<string, { anterior: unknown; nuevo: unknown }>;

type AuditInput = {
  actor_id: string | null;
  entidad: "configuracion" | "site" | "horario" | "excepcion";
  accion: "crear" | "editar" | "eliminar";
  stock_location_id?: string | null;
  referencia?: string | null;
  cambios: Cambios;
};

const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Campos de `fields` que cambian entre `before` y `after`. */
const diff = (
  before: Record<string, any> | null,
  after: Record<string, any>,
  fields: readonly string[]
): Cambios => {
  const cambios: Cambios = {};

  for (const field of fields) {
    const anterior = before?.[field] ?? null;
    const nuevo = after[field] ?? null;

    if (!sameValue(anterior, nuevo)) {
      cambios[field] = { anterior, nuevo };
    }
  }

  return cambios;
};

const SETTING_FIELDS = [
  "capacidad_por_defecto",
  "lead_time_dias",
  "horizonte_dias",
  "dias_abiertos_por_defecto",
] as const;
const SITE_CONFIG_FIELDS = [
  "capacidad_diaria",
  "lead_time_dias",
  "horizonte_dias",
] as const;
const SCHEDULE_FIELDS = ["abierto", "capacidad"] as const;
const EXCEPTION_FIELDS = [
  "fecha",
  "stock_location_id",
  "tipo",
  "irrenunciable",
  "capacidad",
  "motivo",
] as const;

class PickupSchedulingModuleService extends MedusaService({
  PickupSetting,
  SiteSlotConfig,
  SiteSchedule,
  SiteScheduleException,
  PickupOccupancy,
  PickupBooking,
  PickupScheduleChange,
}) {
  protected readonly logger_?: Logger;

  constructor(container: Record<string, any>, ...rest: any[]) {
    // @ts-ignore: MedusaService recibe los mismos argumentos
    super(container, ...rest);

    try {
      this.logger_ = container.logger;
    } catch {
      this.logger_ = undefined;
    }
  }

  // ---------------------------------------------------------------------
  // Configuración
  // ---------------------------------------------------------------------

  /**
   * Configuración global. La primera vez la crea con los valores por
   * defecto (`ON CONFLICT DO NOTHING` evita duplicarla si dos requests
   * llegan a la vez).
   */
  @InjectTransactionManager()
  async getSettings(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Setting> {
    const [found] = await this.listPickupSettings(
      { clave: PICKUP_SETTING_KEY },
      { take: 1 },
      sharedContext
    );

    if (found) {
      return this.toSetting_(found);
    }

    const em = sharedContext.transactionManager as EntityManager;

    await em.execute(
      `INSERT INTO pickup_setting
         (id, clave, capacidad_por_defecto, lead_time_dias, horizonte_dias,
          dias_abiertos_por_defecto, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?::jsonb, now(), now())
       ON CONFLICT DO NOTHING`,
      [
        generateEntityId(undefined, "pkset"),
        PICKUP_SETTING_KEY,
        DEFAULT_LEAD_TIME_DIAS,
        DEFAULT_HORIZONTE_DIAS,
        JSON.stringify(DEFAULT_DIAS_ABIERTOS),
      ],
      "all"
    );

    const [setting] = await this.listPickupSettings(
      { clave: PICKUP_SETTING_KEY },
      { take: 1 },
      sharedContext
    );

    return this.toSetting_(setting);
  }

  private toSetting_(setting: any): Setting {
    return {
      id: setting.id,
      capacidad_por_defecto: setting.capacidad_por_defecto ?? null,
      lead_time_dias: setting.lead_time_dias,
      horizonte_dias: setting.horizonte_dias,
      dias_abiertos_por_defecto: (setting.dias_abiertos_por_defecto ??
        DEFAULT_DIAS_ABIERTOS) as number[],
    };
  }

  /**
   * Edita la configuración global. `actorId`: usuario del Admin, para la
   * auditoría (null = script o sistema).
   */
  @InjectTransactionManager()
  async updateSettings(
    input: UpdatePickupSettingInput,
    actorId: string | null = null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Setting> {
    const current = await this.getSettings(sharedContext);

    assertOptionalNonNegativeInt(
      input.capacidad_por_defecto,
      "La capacidad por defecto"
    );
    assertOptionalNonNegativeInt(input.lead_time_dias, "El lead-time");
    assertOptionalNonNegativeInt(input.horizonte_dias, "El horizonte");

    const lead = input.lead_time_dias ?? current.lead_time_dias;
    const horizonte = input.horizonte_dias ?? current.horizonte_dias;

    if (horizonte < lead) {
      throw invalid(
        "El horizonte no puede ser menor que el lead-time (no quedaría ninguna fecha elegible)."
      );
    }

    let dias: number[] | undefined;

    if (input.dias_abiertos_por_defecto !== undefined) {
      if (!Array.isArray(input.dias_abiertos_por_defecto)) {
        throw invalid("Los días abiertos deben ser una lista de 1 a 7.");
      }

      input.dias_abiertos_por_defecto.forEach(assertDiaSemana);
      dias = [...new Set(input.dias_abiertos_por_defecto)].sort((a, b) => a - b);
    }

    await this.updatePickupSettings(
      {
        id: current.id,
        ...(input.capacidad_por_defecto !== undefined && {
          capacidad_por_defecto: input.capacidad_por_defecto,
        }),
        lead_time_dias: lead,
        horizonte_dias: horizonte,
        ...(dias && { dias_abiertos_por_defecto: dias as any }),
      },
      sharedContext
    );

    const updated = await this.getSettings(sharedContext);

    await this.audit_(
      {
        actor_id: actorId,
        entidad: "configuracion",
        accion: "editar",
        cambios: diff(current, updated, SETTING_FIELDS),
      },
      sharedContext
    );

    return updated;
  }

  /**
   * Crea o actualiza la configuración de un site. Los campos que no vienen
   * en `input` no se tocan; null = heredar el valor global.
   */
  @InjectTransactionManager()
  async upsertSiteSlotConfig(
    input: UpsertSiteSlotConfigInput,
    actorId: string | null = null,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const { stock_location_id, ...data } = input;

    if (!stock_location_id) {
      throw invalid("Falta el site (stock_location_id).");
    }

    assertOptionalNonNegativeInt(data.capacidad_diaria, "La capacidad diaria");
    assertOptionalNonNegativeInt(data.lead_time_dias, "El lead-time");
    assertOptionalNonNegativeInt(data.horizonte_dias, "El horizonte");

    const [existing] = await this.listSiteSlotConfigs(
      { stock_location_id },
      { take: 1 },
      sharedContext
    );

    const lead =
      data.lead_time_dias !== undefined
        ? data.lead_time_dias
        : existing?.lead_time_dias ?? null;
    const horizonte =
      data.horizonte_dias !== undefined
        ? data.horizonte_dias
        : existing?.horizonte_dias ?? null;

    if (lead !== null || horizonte !== null) {
      const setting = await this.getSettings(sharedContext);

      if ((horizonte ?? setting.horizonte_dias) < (lead ?? setting.lead_time_dias)) {
        throw invalid(
          "El horizonte no puede ser menor que el lead-time (no quedaría ninguna fecha elegible)."
        );
      }
    }

    const saved = existing
      ? await this.updateSiteSlotConfigs({ id: existing.id, ...data }, sharedContext)
      : await this.createSiteSlotConfigs({ stock_location_id, ...data }, sharedContext);

    await this.audit_(
      {
        actor_id: actorId,
        entidad: "site",
        accion: existing ? "editar" : "crear",
        stock_location_id,
        cambios: diff(existing ?? null, saved, SITE_CONFIG_FIELDS),
      },
      sharedContext
    );

    return saved;
  }

  /**
   * Crea o actualiza el horario de un día de la semana de un site. Si no
   * viene `capacidad`, se mantiene la actual; cerrar el día la limpia.
   */
  @InjectTransactionManager()
  async upsertSiteSchedule(
    input: UpsertSiteScheduleInput,
    actorId: string | null = null,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const { stock_location_id, dia_semana, abierto } = input;

    if (!stock_location_id) {
      throw invalid("Falta el site (stock_location_id).");
    }

    assertDiaSemana(dia_semana);
    assertOptionalNonNegativeInt(input.capacidad, "La capacidad");

    if (typeof abierto !== "boolean") {
      throw invalid("Indica si el site abre ese día (abierto: true/false).");
    }

    const [existing] = await this.listSiteSchedules(
      { stock_location_id, dia_semana },
      { take: 1 },
      sharedContext
    );

    // Si no viene `capacidad`, se conserva la guardada (igual que en
    // upsertSiteSlotConfig). Al cerrar el día se limpia.
    const capacidad = !abierto
      ? null
      : input.capacidad !== undefined
        ? input.capacidad
        : existing?.capacidad ?? null;

    const saved = existing
      ? await this.updateSiteSchedules(
          { id: existing.id, abierto, capacidad },
          sharedContext
        )
      : await this.createSiteSchedules(
          { stock_location_id, dia_semana, abierto, capacidad },
          sharedContext
        );

    await this.audit_(
      {
        actor_id: actorId,
        entidad: "horario",
        accion: existing ? "editar" : "crear",
        stock_location_id,
        referencia: String(dia_semana),
        cambios: diff(existing ?? null, saved, SCHEDULE_FIELDS),
      },
      sharedContext
    );

    return saved;
  }

  /**
   * Quita el horario propio de un día de la semana: el site vuelve a usar
   * los días abiertos y la capacidad generales. Si no había, no hace nada.
   */
  @InjectTransactionManager()
  async deleteSiteSchedule(
    stockLocationId: string,
    diaSemana: number,
    actorId: string | null = null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    assertDiaSemana(diaSemana);

    const [existing] = await this.listSiteSchedules(
      { stock_location_id: stockLocationId, dia_semana: diaSemana },
      { take: 1 },
      sharedContext
    );

    if (!existing) {
      return;
    }

    await this.deleteSiteSchedules(existing.id, sharedContext);

    await this.audit_(
      {
        actor_id: actorId,
        entidad: "horario",
        accion: "eliminar",
        stock_location_id: stockLocationId,
        referencia: String(diaSemana),
        cambios: diff(existing, {}, SCHEDULE_FIELDS),
      },
      sharedContext
    );
  }

  /**
   * Crea una excepción del calendario (feriado, cierre o apertura especial).
   * Reglas (ver `validateException_`):
   * - `irrenunciable` solo en feriados globales (sin site).
   * - `capacidad` solo en excepciones "abierto" de un site.
   * - No se puede abrir un site en un feriado irrenunciable.
   * - Una excepción por (fecha, site) y una global por fecha.
   */
  @InjectTransactionManager()
  async createException(
    input: CreateExceptionInput,
    actorId: string | null = null,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const data = {
      fecha: input.fecha,
      stock_location_id: input.stock_location_id ?? null,
      tipo: input.tipo,
      irrenunciable: input.irrenunciable ?? false,
      capacidad: input.capacidad ?? null,
      motivo: input.motivo?.trim() || null,
    };

    await this.validateException_(data, null, sharedContext);

    const created = await this.createSiteScheduleExceptions(data, sharedContext);

    await this.audit_(
      {
        actor_id: actorId,
        entidad: "excepcion",
        accion: "crear",
        stock_location_id: data.stock_location_id,
        referencia: data.fecha,
        cambios: diff(null, created, EXCEPTION_FIELDS),
      },
      sharedContext
    );

    return created;
  }

  /**
   * Edita una excepción. Los campos que no vienen no se tocan. Aplica las
   * mismas reglas que al crearla.
   */
  @InjectTransactionManager()
  async updateException(
    id: string,
    input: UpdateExceptionInput,
    actorId: string | null = null,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const existing = await this.retrieveSiteScheduleException(
      id,
      {},
      sharedContext
    );

    const data = {
      fecha: input.fecha ?? existing.fecha,
      stock_location_id:
        input.stock_location_id !== undefined
          ? input.stock_location_id
          : existing.stock_location_id,
      tipo: input.tipo ?? existing.tipo,
      irrenunciable: input.irrenunciable ?? existing.irrenunciable,
      capacidad:
        input.capacidad !== undefined ? input.capacidad : existing.capacidad,
      motivo:
        input.motivo !== undefined
          ? input.motivo?.trim() || null
          : existing.motivo,
    };

    // Una excepción que deja de ser feriado global no puede seguir
    // marcada como irrenunciable, ni una que deja de ser apertura de un
    // site conservar su capacidad.
    if (input.irrenunciable === undefined && data.irrenunciable) {
      data.irrenunciable =
        data.tipo === "feriado" && !data.stock_location_id;
    }
    if (input.capacidad === undefined && data.capacidad !== null) {
      data.capacidad =
        data.tipo === "abierto" && data.stock_location_id
          ? data.capacidad
          : null;
    }

    await this.validateException_(data, id, sharedContext);

    const updated = await this.updateSiteScheduleExceptions(
      { id, ...data },
      sharedContext
    );

    await this.audit_(
      {
        actor_id: actorId,
        entidad: "excepcion",
        accion: "editar",
        stock_location_id: data.stock_location_id,
        referencia: data.fecha,
        cambios: diff(existing, updated, EXCEPTION_FIELDS),
      },
      sharedContext
    );

    return updated;
  }

  /** Elimina una excepción. Si no existe, no hace nada. */
  @InjectTransactionManager()
  async deleteException(
    id: string,
    actorId: string | null = null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [existing] = await this.listSiteScheduleExceptions(
      { id },
      { take: 1 },
      sharedContext
    );

    if (!existing) {
      return;
    }

    await this.deleteSiteScheduleExceptions(id, sharedContext);

    await this.audit_(
      {
        actor_id: actorId,
        entidad: "excepcion",
        accion: "eliminar",
        stock_location_id: existing.stock_location_id,
        referencia: existing.fecha,
        cambios: diff(existing, {}, EXCEPTION_FIELDS),
      },
      sharedContext
    );
  }

  /**
   * Carga los feriados nacionales de Chile de `anio` (data/feriados-chile.ts)
   * como excepciones globales. Idempotente: una fecha que ya tiene una
   * excepción global se deja como está (puede haberla editado el admin).
   * Queda un solo registro de auditoría con las fechas creadas.
   */
  @InjectTransactionManager()
  async loadHolidays(
    anio: number,
    actorId: string | null = null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<LoadHolidaysResult> {
    const feriados = FERIADOS_CHILE[anio];

    if (!feriados) {
      throw notAllowed(
        `No hay feriados cargados para ${anio}. Años disponibles: ${Object.keys(
          FERIADOS_CHILE
        ).join(", ")}.`
      );
    }

    const existentes = await this.listSiteScheduleExceptions(
      {
        fecha: feriados.map((f) => f.fecha),
        stock_location_id: null,
      },
      {},
      sharedContext
    );
    const ocupadas = new Set(existentes.map((e) => e.fecha));
    const nuevos = feriados.filter((f) => !ocupadas.has(f.fecha));

    if (nuevos.length) {
      await this.createSiteScheduleExceptions(
        nuevos.map((f) => ({
          fecha: f.fecha,
          stock_location_id: null,
          tipo: "feriado" as const,
          irrenunciable: f.irrenunciable,
          capacidad: null,
          motivo: f.nombre,
        })),
        sharedContext
      );

      await this.audit_(
        {
          actor_id: actorId,
          entidad: "excepcion",
          accion: "crear",
          referencia: `feriados-${anio}`,
          cambios: {
            feriados: {
              anterior: null,
              nuevo: nuevos.map((f) => `${f.fecha} ${f.nombre}`),
            },
          },
        },
        sharedContext
      );
    }

    return {
      anio,
      creados: nuevos.map((f) => f.fecha),
      omitidos: feriados
        .filter((f) => ocupadas.has(f.fecha))
        .map((f) => f.fecha),
    };
  }

  // ---------------------------------------------------------------------
  // Disponibilidad
  // ---------------------------------------------------------------------

  /** Rango de fechas elegibles del site: [hoy + lead-time, hoy + horizonte]. */
  @InjectManager()
  async getWindow(
    stockLocationId: string,
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<BookingWindow> {
    const setting = await this.getSettings(sharedContext);
    const [config] = await this.listSiteSlotConfigs(
      { stock_location_id: stockLocationId },
      { take: 1 },
      sharedContext
    );

    const lead = config?.lead_time_dias ?? setting.lead_time_dias;
    const horizonte = config?.horizonte_dias ?? setting.horizonte_dias;
    const hoy = toFecha(now);

    return {
      desde: addDays(hoy, lead),
      hasta: addDays(hoy, Math.max(horizonte, lead)),
    };
  }

  /** Resuelve si abre y cuántos cupos tiene el site en cada fecha. */
  @InjectManager()
  async resolveDays(
    stockLocationId: string,
    fechas: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ResolvedDay[]> {
    if (!fechas.length) {
      return [];
    }

    fechas.forEach(assertFecha);

    const rules = await this.loadRules_(stockLocationId, fechas, sharedContext);

    return fechas.map((fecha) => this.resolveDay_(stockLocationId, fecha, rules));
  }

  /**
   * Fechas del rango elegible del site con su disponibilidad. Incluye los
   * días cerrados (para que el storefront pueda mostrarlos deshabilitados).
   */
  @InjectManager()
  async listAvailableDates(
    stockLocationId: string,
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AvailableDate[]> {
    const { desde, hasta } = await this.getWindow(
      stockLocationId,
      now,
      sharedContext
    );

    return await this.listDays(stockLocationId, desde, hasta, sharedContext);
  }

  /**
   * Cada día de [desde, hasta] del site con su capacidad, ocupación y
   * cupos libres, sin mirar el rango elegible (lo usa el Admin para ver la
   * ocupación). Máximo 93 días.
   */
  @InjectManager()
  async listDays(
    stockLocationId: string,
    desde: string,
    hasta: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AvailableDate[]> {
    assertFecha(desde);
    assertFecha(hasta);

    if (hasta < desde) {
      throw invalid("La fecha final no puede ser anterior a la inicial.");
    }

    const fechas = eachFecha(desde, hasta);

    if (fechas.length > 93) {
      throw invalid("El rango no puede superar los 93 días.");
    }

    const days = await this.resolveDays(stockLocationId, fechas, sharedContext);

    const occupancies = await this.listPickupOccupancies(
      {
        stock_location_id: stockLocationId,
        fecha: { $gte: desde, $lte: hasta },
        bloque: null,
      },
      {},
      sharedContext
    );
    const ocupadosPorFecha = new Map(
      occupancies.map((o) => [o.fecha, o.ocupados])
    );

    return days.map((day) => {
      const ocupados = ocupadosPorFecha.get(day.fecha) ?? 0;
      const disponibles =
        day.abierto && day.capacidad !== null
          ? Math.max(day.capacidad - ocupados, 0)
          : 0;

      return { ...day, ocupados, disponibles };
    });
  }

  /**
   * Valida que se pueda reservar (site, fecha) ahora mismo, sin reservar:
   * rango elegible, día abierto, agenda configurada y cupo libre. Lanza el
   * mismo error que daría `reserveBooking`, así el endpoint que guarda la
   * fecha en el carrito y el checkout responden igual.
   *
   * El cupo libre es una foto: entre esta validación y el checkout otro
   * colaborador puede tomar el último. La validación definitiva es la de
   * `reserveBooking`.
   */
  @InjectManager()
  async assertDateBookable(
    stockLocationId: string,
    fecha: string,
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ capacidad: number; ocupados: number }> {
    if (!isValidFecha(fecha)) {
      throw notAllowed("Elige una fecha de retiro válida.");
    }

    const { desde, hasta } = await this.getWindow(
      stockLocationId,
      now,
      sharedContext
    );

    if (fecha < desde) {
      throw notAllowed(
        `La fecha de retiro debe ser desde el ${formatFecha(desde)}.`
      );
    }

    if (fecha > hasta) {
      throw notAllowed(
        `La fecha de retiro debe ser hasta el ${formatFecha(hasta)}.`
      );
    }

    const [day] = await this.resolveDays(
      stockLocationId,
      [fecha],
      sharedContext
    );

    if (!day.abierto) {
      throw notAllowed(
        `El site no atiende retiros el ${formatFecha(fecha)}${
          day.motivo ? ` (${day.motivo})` : ""
        }. Elige otra fecha.`
      );
    }

    if (day.capacidad === null) {
      throw notAllowed(
        "La agenda de retiro no está configurada para este site. Contacta al administrador."
      );
    }

    const [occupancy] = await this.listPickupOccupancies(
      { stock_location_id: stockLocationId, fecha, bloque: null },
      { take: 1 },
      sharedContext
    );
    const ocupados = occupancy?.ocupados ?? 0;

    if (ocupados >= day.capacidad) {
      throw notAllowed(
        `No quedan cupos de retiro para el ${formatFecha(fecha)}. Elige otra fecha.`
      );
    }

    return { capacidad: day.capacidad, ocupados };
  }

  // ---------------------------------------------------------------------
  // Ciclo del cupo
  // ---------------------------------------------------------------------

  /**
   * Toma un cupo para el carrito en (site, fecha). Valida rango elegible,
   * que el site abra y que quede capacidad.
   *
   * Idempotente por `cart_id`: si el carrito ya tiene ese mismo cupo
   * (reintento de completeCart) devuelve `created: false` sin descontar de
   * nuevo. Si tiene un cupo reservado con otro site/fecha (quedó de un
   * intento anterior), lo devuelve y toma el nuevo. Si el cupo ya está
   * asociado a un pedido, rechaza: nunca se toca el cupo de un pedido.
   */
  @InjectTransactionManager()
  async reserveBooking(
    input: ReserveBookingInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ReserveBookingResult> {
    const { cart_id, stock_location_id, fecha } = input;

    if (!cart_id || !stock_location_id) {
      throw invalid("Faltan el carrito o el site de retiro.");
    }

    if (!isValidFecha(fecha)) {
      throw notAllowed("Elige una fecha de retiro válida.");
    }

    const em = sharedContext.transactionManager as EntityManager;

    const [existing] = (await this.listPickupBookings(
      { cart_id },
      { take: 1 },
      sharedContext
    )) as BookingRow[];

    if (existing) {
      // El cupo ya pertenece a un pedido: no se mueve ni se borra desde el
      // checkout (eso sería reagendar, F2 2b).
      if (existing.order_id || existing.estado === "confirmado") {
        throw notAllowed(
          "Este carrito ya tiene un pedido con fecha de retiro asignada."
        );
      }

      if (
        existing.stock_location_id === stock_location_id &&
        existing.fecha === fecha &&
        existing.estado !== "liberado"
      ) {
        return {
          booking_id: existing.id,
          stock_location_id,
          fecha,
          created: false,
        };
      }

      await this.deleteBooking_(em, existing, sharedContext);
    }

    const { capacidad } = await this.assertDateBookable(
      stock_location_id,
      fecha,
      input.now ?? new Date(),
      sharedContext
    );

    await em.execute(
      `INSERT INTO pickup_occupancy
         (id, stock_location_id, fecha, bloque, ocupados, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 0, now(), now())
       ON CONFLICT DO NOTHING`,
      [generateEntityId(undefined, "pkocc"), stock_location_id, fecha],
      "all"
    );

    const updated = await em.execute(
      `UPDATE pickup_occupancy
          SET ocupados = ocupados + 1, updated_at = now()
        WHERE stock_location_id = ?
          AND fecha = ?
          AND bloque IS NULL
          AND deleted_at IS NULL
          AND ocupados < ?
      RETURNING id`,
      [stock_location_id, fecha, capacidad],
      "all"
    );

    if (!updated.length) {
      throw notAllowed(
        `No quedan cupos de retiro para el ${formatFecha(fecha)}. Elige otra fecha.`
      );
    }

    const booking = await this.createPickupBookings(
      { cart_id, stock_location_id, fecha, estado: "reservado" },
      sharedContext
    );

    return {
      booking_id: booking.id,
      stock_location_id,
      fecha,
      created: true,
    };
  }

  /**
   * Compensación de `reserveBooking`: devuelve el cupo y borra la reserva
   * (borrado físico, para que el carrito pueda reintentar). Si ya no existe,
   * no hace nada.
   */
  @InjectTransactionManager()
  async revertBooking(
    bookingId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [booking] = (await this.listPickupBookings(
      { id: bookingId },
      { take: 1 },
      sharedContext
    )) as BookingRow[];

    if (!booking) {
      return;
    }

    const em = sharedContext.transactionManager as EntityManager;

    await this.deleteBooking_(em, booking, sharedContext);
  }

  /**
   * Asocia el pedido al cupo de su carrito y lo confirma. Idempotente.
   * Devuelve el id del cupo, o null si el carrito no tenía cupo.
   * Un cupo ya liberado no se revive.
   */
  @InjectTransactionManager()
  async confirmBooking(
    cartId: string,
    orderId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string | null> {
    const [booking] = (await this.listPickupBookings(
      { cart_id: cartId },
      { take: 1 },
      sharedContext
    )) as BookingRow[];

    if (!booking) {
      return null;
    }

    const estado: EstadoBooking =
      booking.estado === "reservado" ? "confirmado" : booking.estado;

    if (booking.order_id !== orderId || booking.estado !== estado) {
      await this.updatePickupBookings(
        { id: booking.id, order_id: orderId, estado },
        sharedContext
      );
    }

    return booking.id;
  }

  /**
   * Libera el cupo de un pedido anulado/rechazado. Idempotente: si ya
   * estaba liberado no vuelve a descontar. Devuelve null si el pedido no
   * tenía cupo.
   */
  @InjectTransactionManager()
  async releaseBookingByOrder(
    input: ReleaseBookingInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ReleaseBookingResult | null> {
    let [booking] = (await this.listPickupBookings(
      { order_id: input.order_id },
      { take: 1 },
      sharedContext
    )) as BookingRow[];

    // El subscriber de order.placed puede no haber corrido aún.
    if (!booking && input.cart_id) {
      [booking] = (await this.listPickupBookings(
        { cart_id: input.cart_id },
        { take: 1 },
        sharedContext
      )) as BookingRow[];
    }

    if (!booking) {
      return null;
    }

    if (booking.estado === "liberado") {
      return {
        booking_id: booking.id,
        estado_anterior: "liberado",
        released: false,
      };
    }

    const em = sharedContext.transactionManager as EntityManager;

    const updated = await em.execute(
      `UPDATE pickup_booking
          SET estado = 'liberado', updated_at = now()
        WHERE id = ? AND estado = ? AND deleted_at IS NULL
      RETURNING id`,
      [booking.id, booking.estado],
      "all"
    );

    if (!updated.length) {
      // Otro proceso lo liberó entre la lectura y el UPDATE.
      return {
        booking_id: booking.id,
        estado_anterior: "liberado",
        released: false,
      };
    }

    await this.decrementOccupancy_(em, booking);

    return {
      booking_id: booking.id,
      estado_anterior: booking.estado,
      released: true,
    };
  }

  /**
   * Compensación de `releaseBookingByOrder`: vuelve el cupo a su estado
   * anterior y lo suma a la ocupación. No valida la capacidad (solo
   * restaura lo que había).
   */
  @InjectTransactionManager()
  async undoRelease(
    bookingId: string,
    estadoAnterior: EstadoBooking,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    if (estadoAnterior === "liberado") {
      return;
    }

    const em = sharedContext.transactionManager as EntityManager;

    const [row] = await em.execute(
      `UPDATE pickup_booking
          SET estado = ?, updated_at = now()
        WHERE id = ? AND estado = 'liberado' AND deleted_at IS NULL
      RETURNING stock_location_id, fecha`,
      [estadoAnterior, bookingId],
      "all"
    );

    if (!row) {
      return;
    }

    await em.execute(
      `UPDATE pickup_occupancy
          SET ocupados = ocupados + 1, updated_at = now()
        WHERE stock_location_id = ? AND fecha = ?
          AND bloque IS NULL AND deleted_at IS NULL`,
      [row.stock_location_id, row.fecha],
      "all"
    );
  }

  // ---------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------

  /** Reglas de una excepción (crear y editar). `excludeId`: la que se edita. */
  private async validateException_(
    data: {
      fecha: string;
      stock_location_id: string | null;
      tipo: string;
      irrenunciable: boolean;
      capacidad: number | null;
    },
    excludeId: string | null,
    sharedContext: Context
  ): Promise<void> {
    const { fecha, stock_location_id, tipo, irrenunciable, capacidad } = data;

    assertFecha(fecha);

    if (!["feriado", "cerrado", "abierto"].includes(tipo)) {
      throw invalid(`Tipo de excepción inválido: ${tipo}.`);
    }

    if (irrenunciable && (tipo !== "feriado" || stock_location_id)) {
      throw invalid(
        "Solo un feriado que aplica a todos los sites puede marcarse como irrenunciable."
      );
    }

    if (capacidad !== null) {
      assertNonNegativeInt(capacidad, "La capacidad");

      if (tipo !== "abierto" || !stock_location_id) {
        throw invalid(
          "La capacidad solo se puede indicar en una apertura especial de un site."
        );
      }
    }

    if (tipo === "abierto" && stock_location_id) {
      const [global] = await this.listSiteScheduleExceptions(
        { fecha, stock_location_id: null },
        { take: 1 },
        sharedContext
      );

      if (global?.irrenunciable) {
        throw notAllowed(
          `El ${formatFecha(fecha)} es feriado irrenunciable: ningún site puede abrir.`
        );
      }
    }

    const [duplicate] = await this.listSiteScheduleExceptions(
      { fecha, stock_location_id },
      { take: 1 },
      sharedContext
    );

    if (duplicate && duplicate.id !== excludeId) {
      throw invalid(
        stock_location_id
          ? `Este site ya tiene una excepción el ${formatFecha(fecha)}. Edítala o elimínala.`
          : `Ya existe una excepción global el ${formatFecha(fecha)}. Edítala o elimínala.`
      );
    }
  }

  /**
   * Registra un cambio administrativo (tabla + log). No registra nada si
   * no cambió ningún campo.
   */
  private async audit_(input: AuditInput, sharedContext: Context) {
    if (!Object.keys(input.cambios).length) {
      return null;
    }

    const change = await this.createPickupScheduleChanges(
      {
        actor_id: input.actor_id,
        entidad: input.entidad,
        accion: input.accion,
        stock_location_id: input.stock_location_id ?? null,
        referencia: input.referencia ?? null,
        cambios: input.cambios as any,
      },
      sharedContext
    );

    this.logger_?.info(
      `pickup-scheduling: ${input.entidad} ${input.accion}${
        input.stock_location_id ? ` (site ${input.stock_location_id})` : ""
      }${input.referencia ? ` [${input.referencia}]` : ""} por ${
        input.actor_id ?? "sistema"
      }: ${JSON.stringify(input.cambios)}`
    );

    return change;
  }

  /** Carga en 4 consultas todo lo que se necesita para resolver `fechas`. */
  private async loadRules_(
    stockLocationId: string,
    fechas: string[],
    sharedContext: Context
  ): Promise<SiteRules> {
    const sorted = [...fechas].sort();
    const rango = { $gte: sorted[0], $lte: sorted[sorted.length - 1] };

    const setting = await this.getSettings(sharedContext);

    const [config] = await this.listSiteSlotConfigs(
      { stock_location_id: stockLocationId },
      { take: 1 },
      sharedContext
    );

    const horario = await this.listSiteSchedules(
      { stock_location_id: stockLocationId },
      {},
      sharedContext
    );

    const excepciones = await this.listSiteScheduleExceptions(
      {
        fecha: rango,
        $or: [{ stock_location_id: stockLocationId }, { stock_location_id: null }],
      },
      {},
      sharedContext
    );

    const toRow = (e: any): ExceptionRow => ({
      tipo: e.tipo,
      irrenunciable: !!e.irrenunciable,
      capacidad: e.capacidad ?? null,
      motivo: e.motivo ?? null,
    });

    return {
      setting,
      config: config ? { capacidad_diaria: config.capacidad_diaria ?? null } : null,
      horario: new Map(
        horario.map((h) => [
          h.dia_semana,
          { abierto: h.abierto, capacidad: h.capacidad ?? null },
        ])
      ),
      excepcionesSite: new Map(
        excepciones
          .filter((e) => e.stock_location_id === stockLocationId)
          .map((e) => [e.fecha, toRow(e)])
      ),
      excepcionesGlobales: new Map(
        excepciones
          .filter((e) => e.stock_location_id === null)
          .map((e) => [e.fecha, toRow(e)])
      ),
    };
  }

  /** Aplica las reglas de precedencia (ver comentario de la clase). */
  private resolveDay_(
    stockLocationId: string,
    fecha: string,
    rules: SiteRules
  ): ResolvedDay {
    const dia = diaSemana(fecha);
    const horario = rules.horario.get(dia);
    const site = rules.excepcionesSite.get(fecha);
    const global = rules.excepcionesGlobales.get(fecha);

    let abierto: boolean;
    let origen: ResolvedDay["origen"];
    let motivo: string | null = null;

    if (global?.tipo === "feriado" && global.irrenunciable) {
      abierto = false;
      origen = "feriado_irrenunciable";
      motivo = global.motivo;
    } else if (site) {
      abierto = site.tipo === "abierto";
      origen = "excepcion_site";
      motivo = site.motivo;
    } else if (global) {
      abierto = global.tipo === "abierto";
      origen = "excepcion_global";
      motivo = global.motivo;
    } else if (horario) {
      abierto = horario.abierto;
      origen = "horario_site";
    } else {
      abierto = rules.setting.dias_abiertos_por_defecto.includes(dia);
      origen = "por_defecto";
    }

    const capacidad = abierto
      ? firstNonNull(
          site?.tipo === "abierto" ? site.capacidad : null,
          horario?.abierto ? horario.capacidad : null,
          rules.config?.capacidad_diaria,
          rules.setting.capacidad_por_defecto
        )
      : 0;

    return {
      fecha,
      stock_location_id: stockLocationId,
      abierto,
      capacidad,
      origen,
      motivo,
    };
  }

  /** Borra un cupo y, si no estaba liberado, lo descuenta de la ocupación. */
  private async deleteBooking_(
    em: EntityManager,
    booking: BookingRow,
    sharedContext: Context
  ): Promise<void> {
    if (booking.estado !== "liberado") {
      await this.decrementOccupancy_(em, booking);
    }

    await this.deletePickupBookings(booking.id, sharedContext);
  }

  private async decrementOccupancy_(
    em: EntityManager,
    booking: Pick<BookingRow, "stock_location_id" | "fecha">
  ): Promise<void> {
    await em.execute(
      `UPDATE pickup_occupancy
          SET ocupados = GREATEST(ocupados - 1, 0), updated_at = now()
        WHERE stock_location_id = ? AND fecha = ?
          AND bloque IS NULL AND deleted_at IS NULL`,
      [booking.stock_location_id, booking.fecha],
      "all"
    );
  }
}

export default PickupSchedulingModuleService;
