/*

Check rojo de "pedido confirmado". El círculo aparece con un pequeño rebote
y el check se dibuja después (animaciones `pop-in` y `draw-check` de
tailwind.config.js). Con "reducir movimiento" activado en el sistema se
muestra quieto (`motion-safe:`).

Rojo de marca: el mismo #E01441 de la barra de categorías del header.

*/
const SuccessCheck = () => (
  <div
    className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#E01441] shadow-[0_8px_24px_rgba(224,20,65,0.28)] ring-8 ring-[#FDE7EC] motion-safe:animate-pop-in"
    aria-hidden="true"
  >
    <svg viewBox="0 0 48 48" className="h-12 w-12" fill="none">
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
