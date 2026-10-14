/*

Check rojo de "pedido confirmado". El círculo aparece con un pequeño rebote
y el check se dibuja después (animaciones `pop-in` y `draw-check` de
tailwind.config.js). Con "reducir movimiento" activado en el sistema se
muestra quieto (`motion-safe:`).

Rojo de marca: el mismo #E01441 de la barra de categorías del header.

*/
const SuccessCheck = () => (
  <div
    className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#E01441] shadow-[0_6px_16px_rgba(224,20,65,0.25)] ring-4 ring-[#FDE7EC] motion-safe:animate-pop-in"
    aria-hidden="true"
  >
    <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none">
      <path
        d="M13 25l7 7 15-16"
        stroke="white"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="48"
        className="motion-safe:animate-draw-check"
      />
    </svg>
  </div>
)

export default SuccessCheck
