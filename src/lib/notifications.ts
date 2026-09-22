export type NotificationSupport = 'unsupported' | NotificationPermission

export function notificationSupport(): NotificationSupport {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

/** Asks the browser for permission. Never throws; reports the resulting state. */
export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/**
 * Shows a system notification if permitted. Returns false when it couldn't,
 * so the caller can fall back to an in-app message.
 */
export async function showNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (notificationSupport() !== 'granted') return false
  try {
    // Installed/mobile browsers need the service worker to display notifications.
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification(title, { body, tag, icon: '/icons/icon-192.png' })
      return true
    }
    const notification = new Notification(title, { body, tag, icon: '/icons/icon-192.png' })
    notification.onclick = () => window.focus()
    return true
  } catch {
    return false
  }
}
