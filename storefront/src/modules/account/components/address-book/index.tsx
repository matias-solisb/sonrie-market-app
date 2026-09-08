import AddAddress from "@/modules/account/components/address-card/add-address"
import EditAddress from "@/modules/account/components/address-card/edit-address-modal"
import { B2BCustomer } from "@/types/global"
import { HttpTypes } from "@medusajs/types"

type AddressBookProps = {
  customer: B2BCustomer
  region: HttpTypes.StoreRegion
  // Solo un employee admin puede agregar/editar/eliminar direcciones (ver
  // el comentario en `profile-card/index.tsx` sobre `employee.is_admin`).
  // Un cliente normal ve las direcciones existentes pero sin la tarjeta
  // de "Agregar" ni los botones de Edit/Remove — no se le oculta la
  // página, se le oculta la acción.
  isAdmin: boolean
}

const AddressBook: React.FC<AddressBookProps> = ({ customer, region, isAdmin }) => {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 mt-4">
        {isAdmin && <AddAddress region={region} />}
        {customer.addresses.map((address) => {
          return (
            <EditAddress
              region={region}
              address={address}
              key={address.id}
              customer={customer}
              isAdmin={isAdmin}
            />
          )
        })}
      </div>
    </div>
  )
}

export default AddressBook
