import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  setColaboradorEnabledStep,
  type SetColaboradorEnabledInput,
} from "../steps";

/*

Habilitar / deshabilitar a un colaborador (rut-auth, paso 9).

Deshabilitado:
- no puede iniciar sesión (provider `rut`: con la clave correcta ve "Tu
  cuenta está deshabilitada"; con una incorrecta, el mensaje genérico);
- sus sesiones abiertas reciben 401 account_disabled en el siguiente
  request (api/middlewares/account-state.ts);
- no recibe el correo de recuperación.

No borra nada: customer, employee y pedidos quedan intactos. Habilitarlo de
nuevo le devuelve el acceso con la misma clave.

Lo usa la ruta del Admin POST /admin/colaboradores/:customerId/habilitacion
(widget en el detalle del cliente). Más adelante, employee-sync puede
reutilizarlo para las bajas de SAP.

*/
export const setColaboradorEnabledWorkflow = createWorkflow(
  "set-colaborador-enabled",
  function (input: SetColaboradorEnabledInput) {
    const result = setColaboradorEnabledStep(input);
    return new WorkflowResponse(result);
  }
);
