"use client"

import { currencySymbolMap } from "@/lib/constants"
import { updateCompany } from "@/lib/data/companies"
import { useZodForm } from "@/lib/forms/use-zod-form"
import {
  companySchema,
  type CompanyFormValues,
} from "@/lib/validations/company"
import Button from "@/modules/common/components/button"
import {
  FormSelectField,
  FormTextField,
} from "@/modules/common/components/form"
import {
  ModuleCompanySpendingLimitResetFrequency,
  StoreCompanyResponse,
  StoreUpdateCompany,
} from "@/types"
import { AdminRegionCountry, HttpTypes } from "@medusajs/types"
import { Container, Text, clx, toast } from "@medusajs/ui"
import { useMemo, useState } from "react"

const FORM_ID = "company-form"

const FREQUENCY_LABELS: Record<ModuleCompanySpendingLimitResetFrequency, string> =
  {
    [ModuleCompanySpendingLimitResetFrequency.NEVER]: "Nunca",
    [ModuleCompanySpendingLimitResetFrequency.DAILY]: "Diaria",
    [ModuleCompanySpendingLimitResetFrequency.WEEKLY]: "Semanal",
    [ModuleCompanySpendingLimitResetFrequency.MONTHLY]: "Mensual",
    [ModuleCompanySpendingLimitResetFrequency.YEARLY]: "Anual",
  }

const toFormValues = (
  company: StoreCompanyResponse["company"]
): CompanyFormValues => ({
  name: company.name ?? "",
  email: company.email ?? "",
  phone: company.phone ?? "",
  address: company.address ?? "",
  city: company.city ?? "",
  state: company.state ?? "",
  zip: company.zip ?? "",
  country: company.country ?? "",
  currency_code: company.currency_code ?? "",
  spending_limit_reset_frequency:
    company.spending_limit_reset_frequency ??
    ModuleCompanySpendingLimitResetFrequency.NEVER,
})

/*

Card de la empresa. En modo edición usa los campos compartidos de
`common/components/form` + el esquema zod de `lib/validations/company`:
Guardar valida primero y marca en rojo lo que falte, recién ahí llama a
`updateCompany`. El botón Guardar vive fuera del <form> (en el footer de
la card), por eso se asocia con `form={FORM_ID}` — así Enter dentro de un
campo también envía, sin el `onKeyDown` manual que había antes.

*/
const CompanyCard = ({
  company,
  regions,
}: StoreCompanyResponse & { regions: HttpTypes.StoreRegion[] }) => {
  const [isEditing, setIsEditing] = useState(false)

  const { updated_at, created_at, employees, ...companyUpdateData } = company

  const defaultValues = useMemo(() => toFormValues(company), [company])

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useZodForm(companySchema, { defaultValues })

  const cancel = () => {
    reset(defaultValues)
    setIsEditing(false)
  }

  const onSubmit = async (values: CompanyFormValues) => {
    try {
      await updateCompany({
        ...(companyUpdateData as StoreUpdateCompany),
        ...values,
        phone: values.phone ?? "",
      })
    } catch {
      toast.error("No se pudo actualizar la empresa")
      return
    }

    reset(values)
    setIsEditing(false)
    toast.success("Empresa actualizada")
  }

  const currencyOptions = Array.from(
    new Set(regions.map((region) => region.currency_code))
  ).map((currency) => ({
    value: currency,
    label: `${currency.toUpperCase()} (${currencySymbolMap[currency]})`,
  }))

  const countryOptions = (
    Array.from(
      new Set(regions.flatMap((region) => region.countries))
    ) as AdminRegionCountry[]
  ).map((country) => ({ value: country.id, label: country.name }))

  const frequencyOptions = Object.values(
    ModuleCompanySpendingLimitResetFrequency
  ).map((value) => ({ value, label: FREQUENCY_LABELS[value] }))

  return (
    <div className="h-fit">
      <Container className="p-0 overflow-hidden">
        <form
          id={FORM_ID}
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className={clx(
            "grid grid-cols-2 gap-4 border-b border-neutral-200 overflow-hidden transition-all duration-300 ease-in-out ",
            {
              "max-h-[720px] opacity-100 p-4": isEditing,
              "max-h-0 opacity-0": !isEditing,
            }
          )}
        >
          <FormTextField control={control} name="name" label="Nombre" />
          <FormTextField
            control={control}
            name="email"
            label="Correo"
            type="email"
          />
          <FormTextField
            control={control}
            name="phone"
            label="Teléfono"
            type="tel"
          />
          <FormTextField control={control} name="address" label="Dirección" />
          <FormTextField control={control} name="city" label="Ciudad" />
          <FormTextField control={control} name="state" label="Región" />
          <FormTextField control={control} name="zip" label="Código postal" />
          <FormSelectField
            control={control}
            name="country"
            label="País"
            options={countryOptions}
          />
          <FormSelectField
            control={control}
            name="currency_code"
            label="Moneda"
            options={currencyOptions}
          />
          <FormSelectField
            control={control}
            name="spending_limit_reset_frequency"
            label="Reinicio del límite de gasto"
            options={frequencyOptions}
          />
        </form>
        <div
          className={clx(
            "grid grid-cols-2 gap-4 border-b border-neutral-200 transition-all duration-300 ease-in-out",
            {
              "opacity-0 max-h-0": isEditing,
              "opacity-100 max-h-[280px] p-4": !isEditing,
            }
          )}
        >
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">Nombre</Text>
            <Text className=" text-neutral-500">{company.name}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">Correo</Text>
            <Text className=" text-neutral-500">{company.email}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">Teléfono</Text>
            <Text className=" text-neutral-500">{company.phone}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">Dirección</Text>
            <Text className=" text-neutral-500">
              {company.address}, {company.city}, {company.state}, {company.zip},{" "}
              {company.country?.toUpperCase()}
            </Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">Moneda</Text>
            <Text className=" text-neutral-500">
              {company.currency_code?.toUpperCase()} (
              {currencySymbolMap[company.currency_code!]})
            </Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Text className="font-medium text-neutral-950">
              Reinicio del límite de gasto
            </Text>
            <Text className=" text-neutral-500">
              {company.spending_limit_reset_frequency
                ? FREQUENCY_LABELS[company.spending_limit_reset_frequency]
                : "—"}
            </Text>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 bg-neutral-50 p-4">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={cancel}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form={FORM_ID}
                variant="primary"
                isLoading={isSubmitting}
              >
                Guardar
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditing(true)}
            >
              Editar
            </Button>
          )}
        </div>
      </Container>
    </div>
  )
}

export default CompanyCard
