import { getDate, getDay, getDaysInMonth } from 'date-fns'

import type { Occurrence, Task } from '@/types/model'
import { daysBetween, fromDateStr, shiftDate } from './dates'

export function isRecurring(task: Task): boolean {
  return task.dueDate !== null && task.recurrence.kind !== 'none'
}

/** Whether the task's rule generates an occurrence on `date` (ignoring drags). */
function matches(task: Task, date: string): boolean {
  const due = task.dueDate
  if (!due || date < due) return false
  const { kind, weekdays, until } = task.recurrence
  if (until && date > until) return false
  const day = fromDateStr(date)
  const anchor = fromDateStr(due)
  switch (kind) {
    case 'none':
      return date === due
    case 'daily':
      return true
    case 'weekly':
      return getDay(day) === getDay(anchor)
    case 'weekdays':
      return weekdays.includes(getDay(day))
    case 'monthly':
      // A task anchored on the 31st lands on the last day of shorter months.
      return getDate(day) === Math.min(getDate(anchor), getDaysInMonth(day))
  }
}

function occurrence(task: Task, date: string | null, originalDate: string | null): Occurrence {
  const done = isRecurring(task)
    ? originalDate !== null && task.completedDates.includes(originalDate)
    : task.status === 'done'
  return { key: `${task.id}@${originalDate ?? 'none'}`, task, date, originalDate, done }
}

/** Occurrences whose displayed date falls in [from, to] (inclusive). */
export function expandOccurrences(tasks: Task[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = []
  const days = daysBetween(from, to)
  for (const task of tasks) {
    const due = task.dueDate
    if (!due) continue
    if (!isRecurring(task)) {
      if (due >= from && due <= to) out.push(occurrence(task, due, due))
      continue
    }
    for (const day of days) {
      if (task.exceptions[day] !== undefined) continue
      if (matches(task, day)) out.push(occurrence(task, day, day))
    }
    for (const [original, moved] of Object.entries(task.exceptions)) {
      if (moved >= from && moved <= to && matches(task, original)) {
        out.push(occurrence(task, moved, original))
      }
    }
  }
  return out
}

export function undatedOccurrences(tasks: Task[]): Occurrence[] {
  return tasks.filter((task) => !task.dueDate).map((task) => occurrence(task, null, null))
}

export function isOverdue(occ: Occurrence, today: string): boolean {
  return !occ.done && occ.date !== null && occ.date < today
}

/** Chronological: date, then untimed before timed, then time, then creation. */
export function compareByDue(a: Occurrence, b: Occurrence): number {
  if (a.date !== b.date) {
    if (a.date === null) return 1
    if (b.date === null) return -1
    return a.date < b.date ? -1 : 1
  }
  const timeA = a.task.dueTime ?? ''
  const timeB = b.task.dueTime ?? ''
  if (timeA !== timeB) return timeA < timeB ? -1 : 1
  return a.task.createdAt - b.task.createdAt
}

/**
 * Everything the list and dashboard show: one-off tasks of any date (so old
 * overdue items never disappear), recurring tasks expanded over a window
 * around today, and tasks without a date.
 */
export function listOccurrences(tasks: Task[], today: string): Occurrence[] {
  const oneOffs = tasks
    .filter((task) => task.dueDate && !isRecurring(task))
    .map((task) => occurrence(task, task.dueDate, task.dueDate))
  const recurring = expandOccurrences(
    tasks.filter(isRecurring),
    shiftDate(today, -7),
    shiftDate(today, 60),
  )
  return [...oneOffs, ...recurring, ...undatedOccurrences(tasks)]
}
