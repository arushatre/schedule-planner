import { differenceInCalendarDays } from 'date-fns'

import type { Task } from '@/types/model'
import { fromDateStr, shiftDate, toDateStr } from './dates'
import { completionEvents } from './stats'

// Streak history, shared by the web and phone apps. Pure: no storage or network here.

/** One thing the user did in the app (see src/sync/activity.ts for when one is logged). */
export interface ActivityEvent {
  id: string
  /** Epoch ms. Grouped into local days on read, so time zones and DST never shift stored data. */
  at: number
  kind: string
}

/** At most one event is logged per this window, so a burst of edits is one row. */
export const ACTIVITY_THROTTLE_MS = 5 * 60_000

/** Local day → the times (epoch ms, ascending) the user was active that day. */
export function activityByDay(events: ActivityEvent[]): Map<string, number[]> {
  const byDay = new Map<string, number[]>()
  for (const { at } of [...events].sort((a, b) => a.at - b.at)) {
    const day = toDateStr(new Date(at))
    byDay.set(day, [...(byDay.get(day) ?? []), at])
  }
  return byDay
}

/**
 * Days that count toward a streak: any day you used the app, plus any day you finished a task
 * (so history from before activity logging still counts).
 */
export function activeDays(events: ActivityEvent[], tasks: Task[]): Set<string> {
  const days = new Set(activityByDay(events).keys())
  for (const { date } of completionEvents(tasks)) days.add(date)
  return days
}

export interface StreakRun {
  /** First and last day, YYYY-MM-DD. */
  start: string
  end: string
  days: number
  /** Days missed between the previous run and this one; null for the first run. */
  gapBefore: number | null
}

/** Consecutive-day runs, oldest first. */
export function streakRuns(days: Set<string>): StreakRun[] {
  const runs: StreakRun[] = []
  for (const day of [...days].sort()) {
    const last = runs[runs.length - 1]
    if (last && shiftDate(last.end, 1) === day) {
      last.end = day
      last.days += 1
      continue
    }
    const gapBefore = last ? differenceInCalendarDays(fromDateStr(day), fromDateStr(last.end)) - 1 : null
    runs.push({ start: day, end: day, days: 1, gapBefore })
  }
  return runs
}

/** Today doesn't break a streak until it ends, so a run ending yesterday is still current. */
export function currentRun(runs: StreakRun[], today: string): StreakRun | null {
  const last = runs[runs.length - 1]
  return last && (last.end === today || last.end === shiftDate(today, -1)) ? last : null
}

/**
 * How lively the streak looks. 0: none. 1: one day. 2: 2–5 days, a quiet ember.
 * 3: 6–29 days, warmer, with tiny fireworks on hover. 4: 30+ days, the full show.
 */
export function streakTier(days: number): 0 | 1 | 2 | 3 | 4 {
  if (days <= 0) return 0
  if (days === 1) return 1
  if (days <= 5) return 2
  if (days < 30) return 3
  return 4
}
