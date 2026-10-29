/*

¿El anuncio está vigente en `ahora`? Null en `fecha_inicio` o `fecha_fin`
significa "sin límite por ese lado". El inicio es inclusivo y el fin
exclusivo: un anuncio que termina a las 18:00 ya no se ve a las 18:00.

No mira `activo`: eso se filtra en la query.

*/
export type Vigencia = {
  fecha_inicio?: Date | string | null;
  fecha_fin?: Date | string | null;
};

const toTime = (value: Date | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

export const isVigente = (anuncio: Vigencia, ahora: Date = new Date()) => {
  const now = ahora.getTime();
  const inicio = toTime(anuncio.fecha_inicio);
  const fin = toTime(anuncio.fecha_fin);

  if (inicio !== null && now < inicio) {
    return false;
  }
  if (fin !== null && now >= fin) {
    return false;
  }
  return true;
};

/** Error de negocio si el rango es inválido (fin debe ser posterior al inicio). */
export const isRangoValido = (anuncio: Vigencia): boolean => {
  const inicio = toTime(anuncio.fecha_inicio);
  const fin = toTime(anuncio.fecha_fin);
  return inicio === null || fin === null || fin > inicio;
};
