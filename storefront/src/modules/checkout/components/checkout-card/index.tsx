import { clx } from "@medusajs/ui"

/*

Tarjeta del checkout, con el mismo estilo de la confirmación del pedido
(order-completed-template): fondo blanco, bordes redondeados, letra grande.

`step` muestra un círculo numerado ("1 Retiro", "2 Tus datos", "3 Pago")
para que el colaborador sepa en qué parte va. El ícono va en rojo de marca;
las acciones (botones, fecha elegida) van en azul, como en el carrito.

*/
export const BRAND_RED = "#E01441"
export const CREAM = "#FBF8F4"

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
      "rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] small:p-6",
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
