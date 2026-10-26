/*
Id estable del widget "Alta de colaborador" y su zona (Admin). Los usa el widget
(src/admin/widgets/customer-list-alta-colaborador.tsx) y el migration script que lo deja arriba de la tabla
(src/migration-scripts/admin-layout-alta-colaborador.ts). El Admin guarda el
orden por id ("widget:<id>"): si cambias el id, cámbialo también en el
widget (ahí va como texto literal, porque el plugin del Admin no resuelve
constantes) y vuelve a fijar el layout.
*/
export const ALTA_COLABORADOR_WIDGET_ID = "sonrie:alta-colaborador";
export const CUSTOMER_LIST_ZONE = "customer.list";
