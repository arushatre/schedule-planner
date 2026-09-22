import { useEffect } from 'react'

import { formatTime, toDateStr } from '@/lib/dates'
import { showNotification } from '@/lib/notifications'
import { readStored, writeStored } from '@/lib/persist'
import { expandOccurrences } from '@/lib/recurrence'
import { dueReminders, reminderKey } from '@/lib/reminders'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'

const FIRED_KEY = 'daybook:firedReminders'
const CHECK_EVERY_MS = 30_000

function loadFired(today: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(readStored(FIRED_KEY) ?? 'null')
    if (typeof parsed === 'object' && parsed !== null && 'date' in parsed && 'keys' in parsed) {
      const { date, keys } = parsed as { date: unknown; keys: unknown }
      if (date === today && Array.isArray(keys)) return new Set(keys.filter((key): key is string => typeof key === 'string'))
    }
  } catch {
    // Corrupt value: start fresh.
  }
  return new Set()
}

/**
 * Fires reminders while the app is open. Uses a system notification when
 * permitted, otherwise an in-app toast. There is no server, so nothing fires
 * while the app is closed.
 */
export function useReminders(): void {
  useEffect(() => {
    const check = () => {
      const { ready, error, tasks } = useTasksStore.getState()
      const ui = useUiStore.getState()
      if (!ready || error || !ui.remindersEnabled) return

      const now = new Date()
      const today = toDateStr(now)
      const fired = loadFired(today)
      const due = dueReminders(expandOccurrences(tasks, today, today), now, today, fired)
      if (due.length === 0) return

      due.forEach((occ) => fired.add(reminderKey(occ)))
      writeStored(FIRED_KEY, JSON.stringify({ date: today, keys: [...fired] }))

      for (const occ of due) {
        const when = occ.task.dueTime ? ` at ${formatTime(occ.task.dueTime)}` : ''
        void showNotification(occ.task.title, `Due today${when}`, reminderKey(occ)).then((shown) => {
          if (shown) return
          useUiStore.getState().pushToast({
            message: `Reminder: ${occ.task.title}${when}`,
            actionLabel: 'Open',
            onAction: () => useUiStore.getState().openEditor({ mode: 'edit', taskId: occ.task.id }),
          })
        })
      }
    }

    check()
    const id = window.setInterval(check, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
}
