"use client"

import { ChevronDown, TruckFast } from "@medusajs/icons"

// Dirección de retiro: por ahora un valor fijo en texto plano (un único
// <option>) hasta que se conecte la selección real de direcciones/sites del
// colaborador (ver "Selección de site de retiro" en la especificación
// técnica del proyecto). Sigue siendo un <select> real a propósito, para no
// tener que cambiar el markup cuando se agregue la data real.
const PLACEHOLDER_ADDRESS = "Av. Vitacura 4465, Vitacura. -VITACURA"

const DeliveryOptions = () => {
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5"
      data-testid="delivery-options"
    >
      <div className="flex items-center gap-x-2 pb-4 mb-4 border-b border-gray-200">
        <TruckFast className="text-neutral-950" />
        <h2 className="text-base font-semibold text-neutral-950">
          Seleccione las opciones de entrega
        </h2>
      </div>

      <div className="flex flex-col gap-y-1.5 w-full max-w-md">
        <label htmlFor="delivery-address" className="text-xs text-neutral-500">
          Dirección
        </label>
        <div className="relative">
          <select
            id="delivery-address"
            defaultValue={PLACEHOLDER_ADDRESS}
            className="w-full appearance-none rounded-md border border-gray-200 bg-white h-11 pl-3 pr-9 text-sm text-neutral-950 outline-none hover:border-gray-300"
            data-testid="delivery-address-select"
          >
            <option value={PLACEHOLDER_ADDRESS}>{PLACEHOLDER_ADDRESS}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        </div>
      </div>
    </div>
  )
}

export default DeliveryOptions
