import { startOfWeek } from 'date-fns'

import type { Category, Task } from '@/types/model'
import { WEEK_OPTIONS, fromDateStr, shiftDate, toDateStr } from './dates'
import { completionEvents } from './stats'
import { categoryFor } from './tasks'

export interface WeekBucket {
  /** Monday of the week, YYYY-MM-DD. */
  start: string
  /** Completions by category id. */
  counts: Record<string, number>
  total: number
}

export interface CategoryTotal {
  category: Category
  total: number
}

export interface Analytics {
  weeks: WeekBucket[]
  /** Categories with at least one completion in the window, busiest first. */
  categories: CategoryTotal[]
  total: number
  /** Tallest week, at least 1 so charts never divide by zero. */
  max: number
}

/** Completions per category for the last `weekCount` weeks, ending with the current week. */
export function completionsByCategory(
  tasks: Task[],
  categories: Category[],
  today: string,
  weekCount: number,
): Analytics {
  const currentStart = toDateStr(startOfWeek(fromDateStr(today), WEEK_OPTIONS))
  const weeks: WeekBucket[] = Array.from({ length: weekCount }, (_, index) => ({
    start: shiftDate(currentStart, -7 * (weekCount - 1 - index)),
    counts: {},
    total: 0,
  }))
  const byStart = new Map(weeks.map((week) => [week.start, week]))
  const totals = new Map<string, number>()

  for (const event of completionEvents(tasks)) {
    const week = byStart.get(toDateStr(startOfWeek(fromDateStr(event.date), WEEK_OPTIONS)))
    if (!week) continue
    week.counts[event.categoryId] = (week.counts[event.categoryId] ?? 0) + 1
    week.total += 1
    totals.set(event.categoryId, (totals.get(event.categoryId) ?? 0) + 1)
  }

  const ranked = [...totals.entries()]
    .map(([id, total]) => ({ category: categoryFor(id, categories), total }))
    .sort((a, b) => b.total - a.total || a.category.order - b.category.order)

  return {
    weeks,
    categories: ranked,
    total: weeks.reduce((sum, week) => sum + week.total, 0),
    max: Math.max(1, ...weeks.map((week) => week.total)),
  }
}
