import { startOfWeek } from 'date-fns'

import type { Task } from '@/types/model'
import { WEEK_OPTIONS, fromDateStr, shiftDate, toDateStr } from './dates'
import { isRecurring } from './recurrence'

export interface CompletionEvent {
  /** Local YYYY-MM-DD the completion counts toward. */
  date: string
  categoryId: string
}

/**
 * One event per completion: a one-off task counts on the day it was finished;
 * a recurring task counts once per completed occurrence.
 */
export function completionEvents(tasks: Task[]): CompletionEvent[] {
  const events: CompletionEvent[] = []
  for (const task of tasks) {
    if (isRecurring(task)) {
      for (const date of task.completedDates) events.push({ date, categoryId: task.categoryId })
    } else if (task.status === 'done') {
      events.push({ date: toDateStr(new Date(task.completedAt ?? task.updatedAt)), categoryId: task.categoryId })
    }
  }
  return events
}

/** How many tasks were completed on each date. */
export function completionsByDate(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { date } of completionEvents(tasks)) counts.set(date, (counts.get(date) ?? 0) + 1)
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
