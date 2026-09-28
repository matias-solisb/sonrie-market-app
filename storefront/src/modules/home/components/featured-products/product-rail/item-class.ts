/*

Ancho de cada producto dentro de `ProductRail`: ~2 en celular, 3 en
tablet, 5 en escritorio y 6 en pantallas grandes. Se usa en el <li> de cada
item (y en el skeleton de carga, para que midan lo mismo).

Vive en un archivo aparte, sin "use client", porque lo importan Server
Components: una constante exportada desde un módulo "use client" llega al
servidor como una referencia de cliente, no como el string.

*/
export const PRODUCT_RAIL_ITEM_CLASS =
  "w-[45%] shrink-0 snap-start xsmall:w-[30%] small:w-[calc((100%-4rem)/5)] large:w-[calc((100%-5rem)/6)]"
