const EmptyProductsState = () => {
  return (
    <div
      className="flex w-full flex-col items-center gap-x-6 gap-y-4 rounded-large border border-ui-border-base bg-white p-10 small:flex-row small:justify-center"
      data-testid="empty-products-state"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://sonrie.youorder.me/assets/icons/components/ic_cart_and_lens.svg"
        alt=""
        className="h-24 w-24 shrink-0"
      />
      <div className="text-center small:text-left">
        <h2 className="text-2xl-semi text-ui-fg-base">
          Tu búsqueda no arrojó resultados 😓
        </h2>
        <p className="text-ui-fg-subtle">
          Puedes probar con una búsqueda más general o navegando por categorías
        </p>
      </div>
    </div>
  )
}

export default EmptyProductsState
