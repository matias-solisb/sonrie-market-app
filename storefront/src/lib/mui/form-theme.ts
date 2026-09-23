import { createTheme } from "@mui/material/styles"

import { muiTheme } from "@/lib/mui/theme"

/*

Tema de los campos de formulario (`modules/common/components/form`).
Calca los TextField "outlined" del sitio legacy (sonrie.youorder.me), que
usa MUI: label que sube al hacer foco o al escribir, borde gris claro en
reposo, gris oscuro en foco/hover y rojo anaranjado en error.

Extiende `muiTheme` (mismo azul de marca, misma fuente) en vez de
modificarlo, para no cambiar el DatePicker ni el resto de componentes MUI
que ya lo usan. Los estilos van como `styleOverrides` del tema (no como
`sx` en cada campo) para que todos los formularios se vean igual sin
repetir nada.

*/
export const FORM_COLORS = {
  label: "#919EAB",
  labelShrink: "#637381",
  text: "#1C252E",
  border: "rgba(145, 158, 171, 0.2)",
  error: "#FF5630",
} as const

const notched = "& .MuiOutlinedInput-notchedOutline"

export const formTheme = createTheme(muiTheme, {
  palette: {
    error: { main: FORM_COLORS.error },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: FORM_COLORS.label,
          "&.MuiInputLabel-shrink": {
            color: FORM_COLORS.labelShrink,
            fontWeight: 600,
          },
          "&.Mui-focused": { color: FORM_COLORS.text },
          "&.Mui-error": { color: FORM_COLORS.error },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#fff",
          color: FORM_COLORS.text,
          [notched]: { borderColor: FORM_COLORS.border },
          [`&:hover:not(.Mui-disabled):not(.Mui-error) ${notched.slice(2)}`]:
            { borderColor: FORM_COLORS.text },
          [`&.Mui-focused ${notched.slice(2)}`]: {
            borderColor: FORM_COLORS.text,
            borderWidth: 2,
          },
          // Va al final para ganarle a hover/focus cuando hay error.
          [`&.Mui-error ${notched.slice(2)}`]: {
            borderColor: FORM_COLORS.error,
          },
        },
        input: {
          // Autocompletado del navegador: fondo blanco y texto del mismo
          // color que el resto, en vez del celeste de Chrome. El borde
          // negro que `styles/globals.css` pone a los inputs autocompletados
          // ya excluye a los campos MUI (`.MuiInputBase-input`) — en un
          // TextField ese borde es del <input>, no del <fieldset>, y tachaba
          // el label. Se repite :hover/:focus para ganarle en especificidad
          // a cualquier regla global `input:-webkit-autofill:focus`.
          "&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus":
            {
              border: 0,
              borderRadius: "inherit",
              WebkitBoxShadow: "0 0 0 1000px #fff inset",
              WebkitTextFillColor: FORM_COLORS.text,
              caretColor: FORM_COLORS.text,
            },
        },
      },
    },
  },
})
