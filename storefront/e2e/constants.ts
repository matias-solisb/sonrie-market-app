export const AUTH_FILE = "playwright/.auth/user.json"

// Parámetros del login con RUT: se importan del backend (única fuente), así
// los tests siguen solos si Ciberseguridad cambia el lockout.
export {
    INVALID_CREDENTIALS_MESSAGE,
    LOCKOUT,
} from "../../backend/src/modules/rut-auth/config"
