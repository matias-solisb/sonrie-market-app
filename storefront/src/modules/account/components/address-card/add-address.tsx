"use client"

import { addCustomerAddress } from "@/lib/data/customer"
import { useActionForm } from "@/lib/forms/use-action-form"
import useToggleState from "@/lib/hooks/use-toggle-state"
import { addressSchema, emptyAddress } from "@/lib/validations/address"
import {
  FormCancelButton,
  FormSubmitButton,
} from "@/modules/common/components/form"
import Modal from "@/modules/common/components/modal"
import { Plus } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Heading } from "@medusajs/ui"

import AddressFields from "./address-fields"

type AddressActionState = { success: boolean; error: string | null }

const initialState: AddressActionState = { success: false, error: null }

const AddAddress = ({ region }: { region: HttpTypes.StoreRegion }) => {
  const { state: isOpen, open, close: closeModal } = useToggleState(false)

  const {
    form: { control, reset },
    state,
    isPending,
    onSubmit,
  } = useActionForm<typeof addressSchema, AddressActionState>({
    schema: addressSchema,
    action: addCustomerAddress,
    initialState,
    defaultValues: emptyAddress,
    // Cierra el modal (y limpia el form) cada vez que se guarda bien.
    onSuccess: () => close(),
  })

  const close = () => {
    reset(emptyAddress)
    closeModal()
  }


  return (
    <>
      <button
        className="border border-ui-border-base rounded-rounded p-5 min-h-[220px] h-full w-full flex flex-col justify-between"
        onClick={open}
        data-testid="add-address-button"
      >
        <span className="text-base-semi">Nueva dirección</span>
        <Plus />
      </button>

      <Modal isOpen={isOpen} close={close} data-testid="add-address-modal">
        <Modal.Title>
          <Heading className="mb-2">Agregar dirección</Heading>
        </Modal.Title>
        <form noValidate onSubmit={onSubmit}>
          <Modal.Body>
            <AddressFields control={control} region={region} />
            {state.error && (
              <div
                className="text-rose-500 text-small-regular py-2"
                data-testid="address-error"
              >
                {state.error}
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

export default AddAddress
