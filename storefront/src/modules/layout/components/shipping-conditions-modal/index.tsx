"use client"

import Image from "next/image"
import { useState } from "react"

import Modal from "@/modules/common/components/modal"

// Iconos tomados del sitio legacy (mismo dominio ya permitido en
// next.config.js para hero/nav/footer). Mismo set que usaba el modal
// original de "Condiciones de Despacho".
const ICON_BASE = "https://sonrie.youorder.me/assets/icons/notification"

const CONDITIONS = [
  {
    icon: `${ICON_BASE}/ic_truck.svg`,
    title: "Condiciones de cobertura",
    // TODO: "Se despacha en:" queda sin valor, igual que en el sitio
    // legacy (ver captura de referencia) — no hay hoy un dato de zonas/
    // comunas de cobertura en Medusa para completarlo.
    label: "Se despacha en:",
    value: "",
  },
  {
    icon: `${ICON_BASE}/ic_box.svg`,
    title: "Condiciones de entrega",
    // TODO: mismo caso que arriba — "Se despacha los días:" queda sin
    // valor, replicando el estado del sitio legacy.
    label: "Se despacha los días:",
    value: "",
  },
  {
    icon: `${ICON_BASE}/ic_invoice.svg`,
    title: "Condiciones de pedido",
    label: "Pedido mínimo",
    value: "$40.000",
  },
]

const ShippingConditionsModal = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="hover:text-ui-fg-base text-left"
        data-testid="footer-shipping-conditions-trigger"
      >
        Condiciones de Despacho
      </button>

      <Modal
        isOpen={isOpen}
        close={() => setIsOpen(false)}
        panelClassName="max-w-3xl max-h-[75vh] h-fit bg-white shadow-xl border-2 border-black rounded-3xl"
      >
        <Modal.Title>
          <span className="sr-only">Condiciones de Despacho</span>
        </Modal.Title>
        <Modal.Body>
          <div
            className="grid w-full grid-cols-1 gap-4 pt-2 rounded-lg small:grid-cols-3"
            data-testid="shipping-conditions-modal"
          >
            {CONDITIONS.map((condition) => (
              <div
                key={condition.title}
                className="flex flex-col items-center gap-y-3 rounded-lg border border-ui-border-base p-6 text-center"
              >
                <Image
                  src={condition.icon}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10"
                />
                <span className="text-base-semi text-ui-fg-base">
                  {condition.title}
                </span>
                <span className="text-small-regular text-ui-fg-subtle">
                  {condition.label}
                  {condition.value && (
                    <>
                      <br />
                      {condition.value}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Modal.Body>
      </Modal>
    </>
  )
}

export default ShippingConditionsModal
