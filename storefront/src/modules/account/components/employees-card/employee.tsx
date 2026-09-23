"use client"

import { currencySymbolMap } from "@/lib/constants"
import { deleteEmployee, updateEmployee } from "@/lib/data/companies"
import {
  getOrderTotalInSpendWindow,
  getSpendWindow,
} from "@/lib/util/check-spending-limit"
import { useZodForm } from "@/lib/forms/use-zod-form"
import {
  employeeSchema,
  type EmployeeFormInput,
  type EmployeeFormValues,
} from "@/lib/validations/company"
import { formatAmount } from "@/modules/common/components/amount-cell"
import Button from "@/modules/common/components/button"
import {
  FormSelectField,
  FormTextField,
} from "@/modules/common/components/form"
import {
  B2BCustomer,
  QueryCompany,
  QueryEmployee,
  StoreUpdateEmployee,
} from "@/types"
import { HttpTypes } from "@medusajs/types"
import { Prompt, Text, clx, toast } from "@medusajs/ui"
import InputAdornment from "@mui/material/InputAdornment"
import { useState } from "react"

const PERMISSION_OPTIONS = [
  { value: "true", label: "Admin" },
  { value: "false", label: "Empleado" },
]

const RemoveEmployeePrompt = ({ employee }: { employee: QueryEmployee }) => {
  const [isRemoving, setIsRemoving] = useState(false)

  const handleRemove = async () => {
    setIsRemoving(true)
    await deleteEmployee(employee.company_id, employee.id).catch(() => {
      toast.error("Error deleting employee")
    })
    setIsRemoving(false)

    toast.success("Employee deleted")
  }

  return (
    <Prompt variant="danger">
      <Prompt.Trigger asChild>
        <Button variant="transparent">Remove</Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Remove Employee</Prompt.Title>
          <Prompt.Description>
            Are you sure you want to remove{" "}
            <strong>{employee.customer.email}</strong> from your team? They will
            no longer be able to purchase on behalf of your company.
          </Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel className="h-10 rounded-full shadow-borders-base">
            Cancel
          </Prompt.Cancel>
          <Prompt.Action
            className="h-10 px-4 rounded-full shadow-none"
            onClick={handleRemove}
          >
            Remove
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  )
}

const Employee = ({
  employee,
  company,
  orders,
  customer,
}: {
  employee: QueryEmployee
  company: QueryCompany
  orders: HttpTypes.StoreOrder[]
  customer: B2BCustomer | null
}) => {
  const [isEditing, setIsEditing] = useState(false)

  const isCurrentUser = employee.customer.id === customer?.id
  const formId = `employee-form-${employee.id}`

  const defaultValues: EmployeeFormInput = {
    spending_limit: employee.spending_limit.toString(),
    is_admin: employee.is_admin ? "true" : "false",
  }

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useZodForm(employeeSchema, { defaultValues })

  const cancel = () => {
    reset(defaultValues)
    setIsEditing(false)
  }

  // Antes el toast de éxito salía incluso cuando `updateEmployee` fallaba;
  // ahora solo sale si el guardado resultó.
  const onSubmit = async (values: EmployeeFormValues) => {
    try {
      await updateEmployee({
        id: employee.id,
        company_id: employee.company_id,
        spending_limit: values.spending_limit,
        is_admin: values.is_admin === "true",
      } as StoreUpdateEmployee)
    } catch {
      toast.error("No se pudo actualizar el empleado")
      return
    }

    setIsEditing(false)
    toast.success("Empleado actualizado")
  }

  const spent = getOrderTotalInSpendWindow(orders, getSpendWindow(company)) || 0
  const amountSpent = formatAmount(spent, company.currency_code!)

  return (
    <div className="flex flex-col">
      <div className="flex justify-between p-4 border-b border-neutral-200">
        <div className="flex flex-col">
          <Text className=" text-neutral-950 font-medium">
            {employee.customer.first_name} {employee.customer.last_name}{" "}
            {isCurrentUser && "(You)"}{" "}
            {employee.is_admin && (
              <>
                {" • "}
                <span className="text-blue-500">Admin</span>
              </>
            )}
          </Text>
          <div className="flex gap-x-2 small:flex-row flex-col">
            <Text className=" text-neutral-500">{employee.customer.email}</Text>
            <Text className=" text-neutral-500 hidden small:block">
              {" • "}
            </Text>
            <Text className=" text-neutral-500">{employee.customer.phone}</Text>
            <Text className=" text-neutral-500 hidden small:block">
              {" • "}
            </Text>
            <Text className=" text-neutral-500">
              {amountSpent} /{" "}
              {employee.spending_limit > 0
                ? formatAmount(employee.spending_limit, company.currency_code!)
                : "No limit"}{" "}
              spent
            </Text>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
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
                form={formId}
                variant="primary"
                isLoading={isSubmitting}
              >
                Guardar
              </Button>
            </>
          ) : (
            <>
              {!isCurrentUser && <RemoveEmployeePrompt employee={employee} />}
              <Button
                variant="secondary"
                onClick={() => setIsEditing((prev) => !prev)}
              >
                Edit
              </Button>
            </>
          )}
        </div>
      </div>
      <form
        id={formId}
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className={clx(
          "bg-neutral-50 grid grid-cols-2 gap-4 border-b border-neutral-200 transition-all duration-300 ease-in-out",
          {
            "max-h-[160px] opacity-100 p-4": isEditing,
            "max-h-0 h-0 opacity-0 border-b-0 overflow-hidden": !isEditing,
          }
        )}
      >
        <FormTextField
          control={control}
          name="spending_limit"
          label="Límite de gasto"
          helperText="0 = sin límite"
          slotProps={{
            htmlInput: { inputMode: "decimal" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  {currencySymbolMap[company.currency_code!]}
                </InputAdornment>
              ),
            },
          }}
        />
        <FormSelectField
          control={control}
          name="is_admin"
          label="Permisos"
          options={PERMISSION_OPTIONS}
          disabled={!customer?.employee?.is_admin}
        />
      </form>
    </div>
  )
}

export default Employee
