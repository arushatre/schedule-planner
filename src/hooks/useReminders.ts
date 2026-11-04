import { format } from 'date-fns'
import { useEffect } from 'react'

import { toDateStr } from '@/lib/dates'
import { showNotification } from '@/lib/notifications'
import { readStored, writeStored } from '@/lib/persist'
import { expandOccurrences } from '@/lib/recurrence'
import { BRIEFING_HOUR, alertWindow, briefing, dueAlerts } from '@/lib/reminders'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'

const FIRED_KEY = 'daybook:firedAlerts'
const BRIEFED_KEY = 'daybook:lastBriefing'
const CHECK_EVERY_MS = 30_000
/** Enough history to cover a week of alerts without growing forever. */
const FIRED_LIMIT = 500

function loadFired(): string[] {
  try {
    const parsed: unknown = JSON.parse(readStored(FIRED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : []
  } catch {
    return [] // Corrupt value: start fresh.
  }
}

/** System notification when permitted, otherwise an in-app toast. */
function notify(title: string, body: string, tag: string, taskId?: string): void {
  void showNotification(title, body, tag).then((shown) => {
    if (shown) return
    const ui = useUiStore.getState()
    ui.pushToast({
      message: `${title}: ${body}`,
      ...(taskId && { actionLabel: 'Open', onAction: () => ui.openEditor({ mode: 'edit', taskId }) }),
    })
  })
}

/**
 * The notification agent. While Daybook is open (tab or installed app) it
 * watches every task's alerts, catches up on ones missed while it was closed,
 * and sends one morning briefing a day. There is no server, so nothing can
 * wake it while the app is fully closed.
 */
export function useReminders(): void {
  useEffect(() => {
    const check = () => {
      const { ready, error, tasks } = useTasksStore.getState()
      const ui = useUiStore.getState()
      if (!ready || error || !ui.remindersEnabled) return

      const now = new Date()
      const today = toDateStr(now)

      if (ui.briefingEnabled && now.getHours() >= BRIEFING_HOUR && readStored(BRIEFED_KEY) !== today) {
        writeStored(BRIEFED_KEY, today)
        const summary = briefing(tasks, today)
        if (summary) notify(summary.title, summary.body, `briefing-${today}`)
      }

      const { from, to } = alertWindow(today)
      const fired = loadFired()
      const due = dueAlerts(expandOccurrences(tasks, from, to), now, new Set(fired))
      if (due.fired.length === 0) return
      writeStored(FIRED_KEY, JSON.stringify([...fired, ...due.fired].slice(-FIRED_LIMIT)))

      for (const alert of due.notify) {
        const missed = now.getTime() - alert.at.getTime() > 5 * 60_000
        // A caught-up alert reports the real due moment rather than its original lead time.
        const body = missed ? `Due ${format(alert.due, 'EEE h:mm a')} · alert missed while away` : alert.label
        notify(alert.occ.task.title, body, alert.key, alert.occ.task.id)
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
