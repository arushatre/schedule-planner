import { startOfWeek } from 'date-fns'

import type { Task } from '@/types/model'
import { WEEK_OPTIONS, fromDateStr, shiftDate, toDateStr } from './dates'
import { isRecurring } from './recurrence'

/** How many tasks were completed on each date. */
export function completionsByDate(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>()
  const bump = (date: string) => counts.set(date, (counts.get(date) ?? 0) + 1)
  for (const task of tasks) {
    if (isRecurring(task)) {
      task.completedDates.forEach(bump)
    } else if (task.status === 'done') {
      bump(toDateStr(new Date(task.completedAt ?? task.updatedAt)))
    }
  }
  return counts
}

export interface Stats {
  doneToday: number
  doneThisWeek: number
  streak: number
}

/**
 * Streak = consecutive days with at least one completion. Today doesn't break
 * the streak until it ends, so it counts from yesterday if nothing is done yet.
 */
export function computeStats(tasks: Task[], today: string): Stats {
  const counts = completionsByDate(tasks)
  const weekStart = toDateStr(startOfWeek(fromDateStr(today), WEEK_OPTIONS))

  let doneThisWeek = 0
  for (const [date, count] of counts) {
    if (date >= weekStart && date <= today) doneThisWeek += count
  }

  let cursor = (counts.get(today) ?? 0) > 0 ? today : shiftDate(today, -1)
  let streak = 0
  while ((counts.get(cursor) ?? 0) > 0) {
    streak += 1
    cursor = shiftDate(cursor, -1)
  }

  return { doneToday: counts.get(today) ?? 0, doneThisWeek, streak }
}
