import * as Notifications from 'expo-notifications'

import { planNotifications } from '@/lib/reminders'
import type { Task } from '@/types/model'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

const allowed = (status: Notifications.NotificationPermissionsStatus) =>
  status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL

/** Asks once; afterwards iOS only lets the user change it in Settings. */
export async function ensurePermission(): Promise<boolean> {
  if (allowed(await Notifications.getPermissionsAsync())) return true
  return allowed(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }))
}

let queue = Promise.resolve()

/**
 * Replaces every pending notification with a fresh plan. Local notifications
 * fire even when the app is closed; re-running on each change and launch keeps
 * the plan within iOS's 64-notification limit.
 */
export function reschedule(tasks: Task[], enabled: boolean, briefing: boolean): Promise<void> {
  // Serialize runs so two quick edits can't interleave cancel/schedule calls.
  queue = queue.then(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync()
    if (!enabled) return
    for (const item of planNotifications(tasks, new Date(), briefing)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: item.title, body: item.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.date },
      })
    }
  }).catch((error: unknown) => console.warn('Could not schedule notifications', error))
  return queue
}

export function sendTest(): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Daybook', body: 'Notifications are working.' },
    trigger: null,
  })
}

/** Clears every queued alert (on sign-out); runs after any re-plan already in progress. */
export function cancelAll(): Promise<void> {
  queue = queue
    .then(() => Notifications.cancelAllScheduledNotificationsAsync())
    .catch((error: unknown) => console.warn('Could not cancel notifications', error))
  return queue
}
