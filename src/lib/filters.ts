import type { Category, Occurrence, Priority, Status } from '@/types/model'
import { PRIORITIES, PRIORITY_LABEL } from '@/types/model'
import { compareByDue } from './recurrence'
import { searchTaskIds } from './search'
import { friendlyDate } from './dates'
import { categoryFor } from './tasks'

export interface Filters {
  categoryIds: string[]
  tags: string[]
  priorities: Priority[]
  statuses: Status[]
  from: string | null
  to: string | null
  query: string
}

export const EMPTY_FILTERS: Filters = {
  categoryIds: [],
  tags: [],
  priorities: [],
  statuses: [],
  from: null,
  to: null,
  query: '',
}

export type SortKey = 'due' | 'priority' | 'created'
export type GroupKey = 'none' | 'date' | 'category' | 'priority'

export function occurrenceStatus(occ: Occurrence): Status {
  if (occ.done) return 'done'
  return occ.task.status === 'done' ? 'not_started' : occ.task.status
}

/** Number of active filter dimensions (search counts as one). */
export function activeFilterCount(filters: Filters): number {
  return [
    filters.categoryIds.length > 0,
    filters.tags.length > 0,
    filters.priorities.length > 0,
    filters.statuses.length > 0,
    filters.from !== null || filters.to !== null,
    filters.query.trim() !== '',
  ].filter(Boolean).length
}

/** Dimensions combine with AND; several values within one dimension combine with OR. */
export function applyFilters(occurrences: Occurrence[], filters: Filters): Occurrence[] {
  const matchedIds = filters.query.trim()
    ? searchTaskIds(
        occurrences.map((occ) => occ.task),
        filters.query,
      )
    : null

  return occurrences.filter((occ) => {
    const { task } = occ
    if (matchedIds && !matchedIds.has(task.id)) return false
    if (filters.categoryIds.length && !filters.categoryIds.includes(task.categoryId)) return false
    if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false
    if (filters.statuses.length && !filters.statuses.includes(occurrenceStatus(occ))) return false
    if (filters.tags.length && !filters.tags.some((tag) => task.tags.includes(tag))) return false
    if (filters.from || filters.to) {
      if (occ.date === null) return false
      if (filters.from && occ.date < filters.from) return false
      if (filters.to && occ.date > filters.to) return false
    }
    return true
  })
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

export function sortOccurrences(occurrences: Occurrence[], sort: SortKey): Occurrence[] {
  const copy = [...occurrences]
  switch (sort) {
    case 'due':
      return copy.sort(compareByDue)
    case 'priority':
      return copy.sort(
        (a, b) => PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority] || compareByDue(a, b),
      )
    case 'created':
      return copy.sort((a, b) => b.task.createdAt - a.task.createdAt)
  }
}

export interface Group {
  key: string
  label: string
  occurrences: Occurrence[]
}

/** Buckets already-sorted occurrences; group order is fixed per grouping type. */
export function groupOccurrences(
  occurrences: Occurrence[],
  group: GroupKey,
  context: { categories: Category[]; today: string },
): Group[] {
  if (group === 'none') return [{ key: 'all', label: '', occurrences }]

  const buckets = new Map<string, Group>()
  for (const occ of occurrences) {
    let key: string
    let label: string
    if (group === 'date') {
      key = occ.date ?? '~none'
      label = occ.date ? friendlyDate(occ.date, context.today) : 'No date'
    } else if (group === 'category') {
      const category = categoryFor(occ.task.categoryId, context.categories)
      key = category.id
      label = category.name
    } else {
      key = occ.task.priority
      label = `${PRIORITY_LABEL[occ.task.priority]} priority`
    }
    const bucket = buckets.get(key) ?? { key, label, occurrences: [] }
    bucket.occurrences.push(occ)
    buckets.set(key, bucket)
  }

  const groups = [...buckets.values()]
  if (group === 'date') return groups.sort((a, b) => (a.key < b.key ? -1 : 1))
  if (group === 'priority') {
    return groups.sort(
      (a, b) =>
        PRIORITIES.indexOf(b.key as Priority) - PRIORITIES.indexOf(a.key as Priority),
    )
  }
  const order = (id: string) => categoryFor(id, context.categories).order
  return groups.sort((a, b) => order(a.key) - order(b.key))
}
