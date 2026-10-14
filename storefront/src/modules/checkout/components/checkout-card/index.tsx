import { clx } from "@medusajs/ui"

/*

Tarjeta del checkout, con los colores del resto del flujo (carrito,
catálogo): blanco con borde gray-300 y sombra suave sobre fondo blanco.

`step` muestra un círculo numerado ("1 Retiro", "2 Tus datos", "3 Pago")
para que el colaborador sepa en qué parte va. El ícono va en rojo de marca;
las acciones (botones, fecha elegida) van en azul, como en el carrito.

*/
export const BRAND_RED = "#E01441"

type CheckoutCardProps = Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
  step?: number
  icon?: React.ReactNode
  title?: React.ReactNode
  titleId?: string
  action?: React.ReactNode
}

const CheckoutCard = ({
  step,
  icon,
  title,
  titleId,
  action,
  className,
  children,
  ...props
}: CheckoutCardProps) => (
  <section
    aria-labelledby={title && titleId ? titleId : undefined}
    className={clx(
      "rounded-2xl border border-gray-300 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] small:p-6",
      className
    )}
    {...props}
  >
    {title && (
      <div className="mb-4 flex items-center justify-between gap-x-3">
        <div className="flex items-center gap-x-3">
          {step !== undefined && (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-900 text-sm font-bold text-white"
              aria-hidden="true"
            >
              {step}
            </span>
          )}
          <h2
            id={titleId}
            className="flex items-center gap-x-2 text-lg font-semibold text-neutral-900 small:text-xl"
          >
            {icon && (
              <span className="text-[#E01441]" aria-hidden="true">
                {icon}
              </span>
            )}
            {title}
          </h2>
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
)

export default CheckoutCard
