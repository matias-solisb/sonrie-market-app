"use client"

import type { AddressFormValues } from "@/lib/validations/address"
import {
  FormSelectField,
  FormTextField,
} from "@/modules/common/components/form"
import { HttpTypes } from "@medusajs/types"
import { useMemo } from "react"
import type { Control } from "react-hook-form"

/*

Campos de dirección compartidos por AddAddress y EditAddress (antes cada
modal tenía su copia de los 10 inputs). El país usa select nativo porque
vive dentro de `Modal` — ver el comentario de `native` en FormSelectField.

*/
const AddressFields = ({
  control,
  region,
}: {
  control: Control<AddressFormValues>
  region: HttpTypes.StoreRegion
}) => {
  const countryOptions = useMemo(
    () =>
      (region.countries ?? []).map((country) => ({
        value: country.iso_2 ?? "",
        label: country.display_name,
      })),
    [region]
  )

  return (
    <div className="flex flex-col gap-y-4 pt-2">
      <div className="grid grid-cols-2 gap-x-3">
        <FormTextField
          control={control}
          name="first_name"
          label="Nombre"
          autoComplete="given-name"
        />
        <FormTextField
          control={control}
          name="last_name"
          label="Apellido"
          autoComplete="family-name"
        />
      </div>
      <FormTextField
        control={control}
        name="company"
        label="Empresa"
        autoComplete="organization"
      />
      <FormTextField
        control={control}
        name="address_1"
        label="Dirección"
        autoComplete="address-line1"
      />
      <FormTextField
        control={control}
        name="address_2"
        label="Depto., oficina, etc."
        autoComplete="address-line2"
      />
      <div className="grid grid-cols-[144px_1fr] gap-x-3">
        <FormTextField
          control={control}
          name="postal_code"
          label="Código postal"
          autoComplete="postal-code"
        />
        <FormTextField
          control={control}
          name="city"
          label="Ciudad"
          autoComplete="address-level2"
        />
      </div>
      <FormTextField
        control={control}
        name="province"
        label="Región"
        autoComplete="address-level1"
      />
      <FormSelectField
        control={control}
        name="country_code"
        label="País"
        autoComplete="country"
        native
        placeholder="Selecciona un país"
        options={countryOptions}
      />
      <FormTextField
        control={control}
        name="phone"
        label="Teléfono"
        type="tel"
        autoComplete="tel"
      />
    </div>
  )
}

export default AddressFields
