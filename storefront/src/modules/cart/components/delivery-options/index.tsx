"use client"

import { StoreStockLocation } from "@/lib/data/stock-locations"
import { muiTheme } from "@/lib/mui/theme"
import { TruckFast } from "@medusajs/icons"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import MenuItem from "@mui/material/MenuItem"
import Select from "@mui/material/Select"
import { ThemeProvider } from "@mui/material/styles"


// Radio de borde del campo y de la lista desplegable.
const RADIUS = 8
const FIELD_HEIGHT = 48

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
        <ThemeProvider theme={muiTheme}>
          <FormControl
            fullWidth
            size="small"
            disabled={!hasLocations}
            sx={{
              "& .MuiOutlinedInput-root": {
                height: FIELD_HEIGHT,
                borderRadius: `${RADIUS}px`,
                backgroundColor: "#fff",
                fontSize: 14,
                color: "#0a0a0a",
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "#e5e7eb", // gray-200
              },
              "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline":
                {
                  borderColor: "#d1d5db", // gray-300
                },
              // Abierto/enfocado: borde y label oscuros (no el azul del tema).
              "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
                {
                  borderColor: "#0a0a0a",
                  borderWidth: 1.5,
                },
              "& .MuiInputLabel-root": { fontSize: 14 },
              "& .MuiInputLabel-shrink": { fontWeight: 600, color: "#404040" },
              "& .MuiInputLabel-root.Mui-focused": { color: "#0a0a0a" },
            }}
          >
            <InputLabel id="delivery-address-label" shrink>
              Dirección
            </InputLabel>
            <Select
              labelId="delivery-address-label"
              id="delivery-address"
              label="Dirección"
              notched
              displayEmpty
              value={hasLocations ? selectedStockLocationId || "" : ""}
              onChange={(e) => onChangeStockLocation(String(e.target.value))}
              data-testid="delivery-address-select"
              MenuProps={{
                // La lista se abre debajo del campo, alineada a su borde
                // izquierdo y con su mismo ancho (MUI la iguala al ancho
                // del anchor por defecto).
                anchorOrigin: { vertical: "bottom", horizontal: "left" },
                transformOrigin: { vertical: "top", horizontal: "left" },
                slotProps: {
                  list: { sx: { py: 0.5 } },
                  paper: {
                    sx: {
                      mt: 0.5,
                      borderRadius: `${RADIUS}px`,
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
                    },
                  },
                },
              }}
            >
              {hasLocations ? (
                stockLocations.map((location) => (
                  <MenuItem
                    key={location.id}
                    value={location.id}
                    sx={{
                      fontSize: 14,
                      mx: 0.5,
                      borderRadius: `${RADIUS - 2}px`,
                      whiteSpace: "normal",
                      "&.Mui-selected, &.Mui-selected:hover": {
                        backgroundColor: "#eef0f2",
                        fontWeight: 600,
                      },
                    }}
                  >
                    {formatLocationLabel(location)}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value="" sx={{ fontSize: 14 }}>
                  No hay sites de retiro configurados
                </MenuItem>
              )}
            </Select>
          </FormControl>
        </ThemeProvider>
      </div>
    </div>
  )
}

export default DeliveryOptions
