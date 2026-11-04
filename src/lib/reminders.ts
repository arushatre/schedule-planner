import { parse, subMinutes } from 'date-fns'

import { formatTime, shiftDate } from '@/lib/dates'
import { compareByDue, expandOccurrences, isOverdue, listOccurrences } from '@/lib/recurrence'
import type { Occurrence, Task } from '@/types/model'

/** A reminder older than this when we notice it is skipped, unless the task still lies ahead. */
export const MAX_LATE_MINUTES = 120

/** Untimed tasks are treated as due at this time for "before" alerts. */
export const DEFAULT_DUE_TIME = '09:00'

/** Offsets (minutes before due) offered in the editor. */
export const ALERT_OFFSETS = [0, 10, 30, 60, 120, 1440, 2880, 10080] as const

/** How far ahead to look for occurrences whose alerts may fire now. */
export const ALERT_LOOKAHEAD_DAYS = 8

export function alertLabel(minutes: number): string {
  if (minutes === 0) return 'At due time'
  if (minutes < 60) return `${minutes} min before`
  if (minutes < 1440) return `${minutes / 60} hr before`
  if (minutes === 10080) return '1 week before'
  return `${minutes / 1440} day${minutes === 1440 ? '' : 's'} before`
}

export interface DueAlert {
  /** Stable while the alert's moment is unchanged, so edits re-arm it. */
  key: string
  occ: Occurrence
  at: Date
  due: Date
  /** "Due in 1 hr", "Reminder", ... */
  label: string
}

const at = (date: string, time: string) => parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date())

/** Every alert moment for one occurrence: its reminder time plus each "before" offset. */
export function alertsFor(occ: Occurrence): DueAlert[] {
  const { task, date } = occ
  if (!date || occ.done) return []
  const due = at(date, task.dueTime ?? DEFAULT_DUE_TIME)
  const list: { at: Date; label: string }[] = task.alerts.map((minutes) => ({
    at: subMinutes(due, minutes),
    label: minutes === 0 ? 'Due now' : `Due in ${alertLabel(minutes).replace(' before', '')}`,
  }))
  if (task.reminderTime) list.push({ at: at(date, task.reminderTime), label: 'Reminder' })
  return list.map((alert) => ({ ...alert, due, occ, key: `${occ.key}@${alert.at.getTime()}` }))
}

/**
 * Alerts that should fire now: their moment has passed, they haven't fired,
 * and they're either recent or the task is still ahead (catch-up after the
 * app was closed). Only the latest per occurrence is notified; `fired` lists
 * every key handled, including superseded ones.
 */
export function dueAlerts(occurrences: Occurrence[], now: Date, fired: Set<string>): { notify: DueAlert[]; fired: string[] } {
  const nowMs = now.getTime()
  const due = occurrences.flatMap(alertsFor).filter((alert) => {
    const late = nowMs - alert.at.getTime()
    if (late < 0 || fired.has(alert.key)) return false
    return late <= MAX_LATE_MINUTES * 60_000 || alert.due.getTime() >= nowMs
  })
  const latest = new Map<string, DueAlert>()
  for (const alert of due) {
    const current = latest.get(alert.occ.key)
    if (!current || alert.at > current.at) latest.set(alert.occ.key, alert)
  }
  return { notify: [...latest.values()], fired: due.map((alert) => alert.key) }
}

/** Window of dates whose occurrences can have alerts due today. */
export function alertWindow(today: string): { from: string; to: string } {
  return { from: shiftDate(today, -1), to: shiftDate(today, ALERT_LOOKAHEAD_DAYS) }
}

/** The morning briefing fires once a day, on the first check after this hour. */
export const BRIEFING_HOUR = 7

/** A one-glance summary of the day: what's due, what's overdue, what's next, tomorrow's load. */
export function briefing(tasks: Task[], today: string): { title: string; body: string } | null {
  const open = (occs: Occurrence[]) => occs.filter((occ) => !occ.done)
  const todays = open(expandOccurrences(tasks, today, today)).sort(compareByDue)
  const overdue = listOccurrences(tasks, today).filter((occ) => isOverdue(occ, today)).length
  const tomorrow = open(expandOccurrences(tasks, shiftDate(today, 1), shiftDate(today, 1))).length
  if (todays.length + overdue + tomorrow === 0) return null

  const next = todays.find((occ) => occ.task.dueTime) ?? todays[0]
  const body = [
    overdue > 0 && `${overdue} overdue`,
    next && `Next: ${next.task.title}${next.task.dueTime ? ` at ${formatTime(next.task.dueTime)}` : ''}`,
    tomorrow > 0 && `${tomorrow} due tomorrow`,
  ].filter(Boolean)
  const title = todays.length > 0 ? `${todays.length} due today` : 'Nothing due today'
  return { title, body: body.join(' · ') }
}
