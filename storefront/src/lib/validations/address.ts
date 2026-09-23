import { z } from "zod"

import {
  optionalString,
  requiredString,
  requiredStringF,
} from "@/lib/validations/common"

// Dirección del customer (agregar / editar en /account/addresses). Mismos
// campos que leen `addCustomerAddress` / `updateCustomerAddress`.
export const addressSchema = z.object({
  first_name: requiredString("Nombre"),
  last_name: requiredString("Apellido"),
  company: optionalString(),
  address_1: requiredStringF("Dirección"),
  address_2: optionalString(),
  postal_code: requiredString("Código postal"),
  city: requiredStringF("Ciudad"),
  province: optionalString(),
  country_code: requiredString("País"),
  phone: optionalString(),
})

export type AddressFormValues = z.infer<typeof addressSchema>

export const emptyAddress: AddressFormValues = {
  first_name: "",
  last_name: "",
  company: "",
  address_1: "",
  address_2: "",
  postal_code: "",
  city: "",
  province: "",
  country_code: "",
  phone: "",
}
