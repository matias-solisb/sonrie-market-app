"use client"

import {
  deleteCustomerAddress,
  updateCustomerAddress,
} from "@/lib/data/customer"
import { useActionForm } from "@/lib/forms/use-action-form"
import useToggleState from "@/lib/hooks/use-toggle-state"
import {
  addressSchema,
  type AddressFormValues,
} from "@/lib/validations/address"
import {
  FormCancelButton,
  FormSubmitButton,
} from "@/modules/common/components/form"
import Modal from "@/modules/common/components/modal"
import Spinner from "@/modules/common/icons/spinner"
import { B2BCustomer } from "@/types/global"
import { PencilSquare as Edit, Trash } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Heading, Text, clx } from "@medusajs/ui"
import React, { useMemo, useState } from "react"

import AddressFields from "./address-fields"

type EditAddressProps = {
  region: HttpTypes.StoreRegion
  address: HttpTypes.StoreCustomerAddress
  customer: B2BCustomer
  isActive?: boolean
  // Solo un employee admin puede editar/eliminar direcciones — ver el
  // comentario en `profile-card/index.tsx` sobre `employee.is_admin`. En
  // `false` esta card se ve igual pero sin la fila de botones Edit/Remove
  // (ni el modal de edición, que solo se abre desde esos botones).
  isAdmin?: boolean
}

type EditAddressActionState = {
  success: boolean
  error: string | null
  // `updateCustomerAddress` lee el id de la dirección desde el estado
  // anterior de `useActionState`.
  addressId: string
}

const EditAddress: React.FC<EditAddressProps> = ({
  region,
  address,
  customer,
  isActive = false,
  isAdmin = false,
}) => {
  const [removing, setRemoving] = useState(false)
  const { state: isOpen, open, close: closeModal } = useToggleState(false)

  // Valores actuales de la dirección como punto de partida del form. Se
  // recalculan cuando la dirección cambia (revalidación tras guardar), así
  // al reabrir el modal se ven los datos nuevos.
  const addressValues = useMemo<AddressFormValues>(
    () => ({
      first_name: address.first_name ?? "",
      last_name: address.last_name ?? "",
      company: address.company ?? "",
      address_1: address.address_1 ?? "",
      address_2: address.address_2 ?? "",
      postal_code: address.postal_code ?? "",
      city: address.city ?? "",
      province: address.province ?? "",
      country_code: address.country_code ?? "",
      phone: address.phone ?? "",
    }),
    [address]
  )

  const {
    form: { control, reset },
    state: formState,
    isPending,
    onSubmit,
  } = useActionForm<typeof addressSchema, EditAddressActionState>({
    schema: addressSchema,
    action: updateCustomerAddress,
    initialState: { success: false, error: null, addressId: address.id },
    defaultValues: addressValues,
    // Cierra el modal cada vez que se guarda bien.
    onSuccess: () => close(),
  })

  const close = () => {
    reset(addressValues)
    closeModal()
  }


  const removeAddress = async () => {
    setRemoving(true)
    await deleteCustomerAddress(address.id)
    setRemoving(false)
  }

  return (
    <>
      <div
        className={clx(
          "border rounded-rounded p-5 min-h-[220px] h-full w-full flex flex-col justify-between transition-colors",
          {
            "border-gray-900": isActive,
          }
        )}
        data-testid="address-container"
      >
        <div className="flex flex-col">
          <Heading
            className="text-left text-base-semi"
            data-testid="address-name"
          >
            {address.first_name} {address.last_name}
          </Heading>
          {address.company && (
            <Text
              className="txt-compact-small text-ui-fg-base"
              data-testid="address-company"
            >
              {address.company}
            </Text>
          )}
          <Text className="flex flex-col text-left text-base-regular mt-2">
            <span data-testid="address-address">
              {address.address_1}
              {address.address_2 && <span>, {address.address_2}</span>}
            </span>
            <span data-testid="address-postal-city">
              {address.postal_code}, {address.city}
            </span>
            <span data-testid="address-province-country">
              {address.province && `${address.province}, `}
              {address.country_code?.toUpperCase()}
            </span>
          </Text>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-x-4">
            <button
              className="text-small-regular text-ui-fg-base flex items-center gap-x-2"
              onClick={open}
              data-testid="address-edit-button"
            >
              <Edit />
              Edit
            </button>
            <button
              className="text-small-regular text-ui-fg-base flex items-center gap-x-2"
              onClick={removeAddress}
              data-testid="address-delete-button"
            >
              {removing ? <Spinner /> : <Trash />}
              Remove
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={isOpen} close={close} data-testid="edit-address-modal">
        <Modal.Title>
          <Heading className="mb-2">Editar dirección</Heading>
        </Modal.Title>
        <form noValidate onSubmit={onSubmit}>
          <Modal.Body>
            <AddressFields control={control} region={region} />
            {formState.error && (
              <div className="text-rose-500 text-small-regular py-2">
                {formState.error}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <div className="flex gap-3 mt-6">
              <FormCancelButton onClick={close} data-testid="cancel-button">
                Cancelar
              </FormCancelButton>
              <FormSubmitButton
                isPending={isPending}
                pendingLabel="Guardando..."
                data-testid="save-button"
              >
                Guardar
              </FormSubmitButton>
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  )
}

export default EditAddress
