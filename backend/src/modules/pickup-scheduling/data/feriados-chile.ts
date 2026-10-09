/*

Feriados NACIONALES de Chile, para cargarlos como excepciones globales de
la agenda de retiro (botón "Cargar feriados de Chile" del Admin y script
load-pickup-holidays.ts).

Decisiones (oct-2026):
- Solo feriados nacionales.
- `irrenunciable`: los de la Ley 19.973 para trabajadores del comercio
  (1-ene, 1-may, 18-sep, 19-sep y 25-dic). Ningún site puede abrir esos
  días. Las jornadas electorales también son irrenunciables, pero no hay
  elecciones nacionales en 2026–2027; si se fija alguna, se agrega a mano.
- Las fechas ya vienen trasladadas según la ley (San Pedro y San Pablo,
  Encuentro de Dos Mundos, Iglesias Evangélicas) y 2027 incluye el feriado
  adicional del 17 de septiembre.

Fuentes (consultadas el 8-oct-2026):
- https://www.feriados.cl/ y https://www.feriados.cl/2027.php
- Dirección del Trabajo, feriados irrenunciables del comercio:
  https://www.dt.gob.cl/portal/1628/w3-article-95017.html

Los feriados cambian por ley: revisar la lista de cada año antes de
cargarla y agregar aquí el año siguiente.

*/
export type FeriadoChile = {
  fecha: string;
  nombre: string;
  irrenunciable: boolean;
};

export const FERIADOS_CHILE: Record<number, FeriadoChile[]> = {
  2026: [
    { fecha: "2026-01-01", nombre: "Año Nuevo", irrenunciable: true },
    { fecha: "2026-04-03", nombre: "Viernes Santo", irrenunciable: false },
    { fecha: "2026-04-04", nombre: "Sábado Santo", irrenunciable: false },
    { fecha: "2026-05-01", nombre: "Día Nacional del Trabajo", irrenunciable: true },
    { fecha: "2026-05-21", nombre: "Día de las Glorias Navales", irrenunciable: false },
    { fecha: "2026-06-21", nombre: "Día Nacional de los Pueblos Indígenas", irrenunciable: false },
    { fecha: "2026-06-29", nombre: "San Pedro y San Pablo", irrenunciable: false },
    { fecha: "2026-07-16", nombre: "Día de la Virgen del Carmen", irrenunciable: false },
    { fecha: "2026-08-15", nombre: "Asunción de la Virgen", irrenunciable: false },
    { fecha: "2026-09-18", nombre: "Independencia Nacional", irrenunciable: true },
    { fecha: "2026-09-19", nombre: "Día de las Glorias del Ejército", irrenunciable: true },
    { fecha: "2026-10-12", nombre: "Encuentro de Dos Mundos", irrenunciable: false },
    { fecha: "2026-10-31", nombre: "Día de las Iglesias Evangélicas y Protestantes", irrenunciable: false },
    { fecha: "2026-11-01", nombre: "Día de Todos los Santos", irrenunciable: false },
    { fecha: "2026-12-08", nombre: "Inmaculada Concepción", irrenunciable: false },
    { fecha: "2026-12-25", nombre: "Navidad", irrenunciable: true },
  ],
  2027: [
    { fecha: "2027-01-01", nombre: "Año Nuevo", irrenunciable: true },
    { fecha: "2027-03-26", nombre: "Viernes Santo", irrenunciable: false },
    { fecha: "2027-03-27", nombre: "Sábado Santo", irrenunciable: false },
    { fecha: "2027-05-01", nombre: "Día Nacional del Trabajo", irrenunciable: true },
    { fecha: "2027-05-21", nombre: "Día de las Glorias Navales", irrenunciable: false },
    { fecha: "2027-06-21", nombre: "Día Nacional de los Pueblos Indígenas", irrenunciable: false },
    { fecha: "2027-06-28", nombre: "San Pedro y San Pablo", irrenunciable: false },
    { fecha: "2027-07-16", nombre: "Día de la Virgen del Carmen", irrenunciable: false },
    { fecha: "2027-08-15", nombre: "Asunción de la Virgen", irrenunciable: false },
    { fecha: "2027-09-17", nombre: "Feriado adicional Fiestas Patrias", irrenunciable: false },
    { fecha: "2027-09-18", nombre: "Independencia Nacional", irrenunciable: true },
    { fecha: "2027-09-19", nombre: "Día de las Glorias del Ejército", irrenunciable: true },
    { fecha: "2027-10-11", nombre: "Encuentro de Dos Mundos", irrenunciable: false },
    { fecha: "2027-10-31", nombre: "Día de las Iglesias Evangélicas y Protestantes", irrenunciable: false },
    { fecha: "2027-11-01", nombre: "Día de Todos los Santos", irrenunciable: false },
    { fecha: "2027-12-08", nombre: "Inmaculada Concepción", irrenunciable: false },
    { fecha: "2027-12-25", nombre: "Navidad", irrenunciable: true },
  ],
};

export const ANIOS_CON_FERIADOS = Object.keys(FERIADOS_CHILE).map(Number);
