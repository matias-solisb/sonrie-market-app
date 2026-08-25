import { BellAlert } from "@medusajs/icons"

const NotificationBell = () => {
  return (
    <button
      type="button"
      aria-label="Notificaciones"
      className="flex items-center justify-center text-ui-fg-base hover:text-ui-fg-subtle"
      data-testid="nav-notification-bell"
    >
      <BellAlert />
    </button>
  )
}

export default NotificationBell
