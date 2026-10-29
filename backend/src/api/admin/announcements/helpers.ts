import { MedusaError } from "@medusajs/framework/utils";
import { isRangoValido, Vigencia } from "../../../modules/announcements/utils/vigencia";

export const assertRangoVigencia = (vigencia: Vigencia) => {
  if (!isRangoValido(vigencia)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "La fecha de fin debe ser posterior a la fecha de inicio"
    );
  }
};
