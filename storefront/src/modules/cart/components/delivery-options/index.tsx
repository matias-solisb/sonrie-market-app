"use client"

import { ChevronDown, TruckFast } from "@medusajs/icons"
import { StoreStockLocation } from "@/lib/data/stock-locations"

// Dirección de retiro: se conectara la selección
// real de direcciones/sites del colaborador (ver "Selección de site de
// retiro" en la especificación técnica del proyecto). Ahora recibe los
// Stock Locations reales (con su address_1/city) desde CartTemplate, que
// los pidió a `/store/stock-locations`.
const formatLocationLabel = (location: StoreStockLocation) => {
  const address1 = location.address?.address_1?.trim()
  const city = location.address?.city?.trim()

  if (!address1 && !city) {
    return location.name
  }

  return [address1, city].filter(Boolean).join(", ")
}

type DeliveryOptionsProps = {
  stockLocations: StoreStockLocation[]
  selectedStockLocationId: string | null
  onChangeStockLocation: (stockLocationId: string) => void
}

const DeliveryOptions = ({
  stockLocations,
  selectedStockLocationId,
  onChangeStockLocation,
}: DeliveryOptionsProps) => {
  const hasLocations = stockLocations.length > 0

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5"
      data-testid="delivery-options"
    >
      <div className="flex items-center gap-x-2 pb-4 mb-4 border-b border-gray-200">
        <TruckFast className="text-neutral-950" />
        <h2 className="text-base font text-neutral-950">
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
            value={selectedStockLocationId || ""}
            onChange={(e) => onChangeStockLocation(e.target.value)}
            disabled={!hasLocations}
            className="w-full appearance-none rounded-md border border-gray-200 bg-white h-11 pl-3 pr-9 text-sm text-neutral-950 outline-none hover:border-gray-300 disabled:text-neutral-400"
            data-testid="delivery-address-select"
          >
            {hasLocations ? (
              stockLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {formatLocationLabel(location)}
                </option>
              ))
            ) : (
              <option value="">No hay sites de retiro configurados</option>
            )}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        </div>
      </div>
    </div>
  )
}

export default DeliveryOptions
