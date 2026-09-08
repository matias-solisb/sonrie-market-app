import { createTheme } from "@mui/material/styles"

/*

Tema mínimo de Material UI, usado únicamente por los componentes MUI que
imitan el look del sitio legacy (sonrie.youorder.me), que está construido
con Material UI (@mui/material + @mui/x-date-pickers — confirmado
inspeccionando los chunks JS que sirve ese sitio: aparecen clases internas
reales de MUI como `MuiPickersLayout`, `MuiPaper`, `MuiSvgIcon`, etc. No
hay forma de leer su package.json porque no tenemos el código fuente,
pero esas clases solo existen si el paquete real está bundleado).

Por ahora el único lugar que usa este tema es el `DatePicker` de "Fecha
desde"/"Fecha hasta" en `document-filters`. No se aplica ningún reset
global (nada de `CssBaseline`) a propósito, para no tocar el resto del
sitio, que sigue siendo 100% Tailwind + @medusajs/ui.

`primary.main` usa el mismo azul que ya es la marca en todo el sitio
(`blue-900` de Tailwind = #1e3a8a) para que el foco/selección del
calendario combine con el resto de la UI en vez de usar el morado por
defecto de MUI.

*/
export const muiTheme = createTheme({
  palette: {
    primary: {
      main: "#1e3a8a", // Tailwind blue-900 — mismo azul que el resto del sitio
    },
  },
  shape: {
    borderRadius: 6, // ~ Tailwind rounded-md, para que combine con las otras cajas de la barra de filtros
  },
  typography: {
    fontFamily: "inherit", // hereda la fuente del sitio (Geist) en vez de la de MUI
  },
})
