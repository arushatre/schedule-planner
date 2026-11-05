import { describe, expect, it } from 'vitest'

import { EMPTY_FILTERS, activeFilterCount, applyFilters, groupOccurrences, sortOccurrences } from './filters'
import { expandOccurrences, undatedOccurrences } from './recurrence'
import { dropIndex, makeTask, nextSortOrder, orderAfterMove } from './tasks'
import type { Category } from '@/types/model'

const categories: Category[] = [
  { id: 'school', name: 'School', colorKey: 'slate', archived: false, order: 0, createdAt: 0 },
  { id: 'work', name: 'Work', colorKey: 'clay', archived: false, order: 1, createdAt: 0 },
]

const tasks = [
  makeTask({ title: 'Essay draft', categoryId: 'school', dueDate: '2026-09-22', priority: 'high', tags: ['english'], createdAt: 1 }),
  makeTask({ title: 'Quarterly report', categoryId: 'work', dueDate: '2026-09-23', priority: 'low', notes: 'finance numbers', createdAt: 2 }),
  makeTask({ title: 'Read chapter', categoryId: 'school', dueDate: '2026-09-24', priority: 'medium', status: 'done', createdAt: 3 }),
  makeTask({ title: 'Someday idea', categoryId: 'work', createdAt: 4 }),
]
const all = [...expandOccurrences(tasks, '2026-09-01', '2026-09-30'), ...undatedOccurrences(tasks)]
const titles = (occs: typeof all) => occs.map((occ) => occ.task.title)

describe('applyFilters', () => {
  it('returns everything with no filters', () => {
    expect(applyFilters(all, EMPTY_FILTERS)).toHaveLength(4)
  })

  it('ANDs dimensions together', () => {
    const result = applyFilters(all, { ...EMPTY_FILTERS, categoryIds: ['school'], priorities: ['high'] })
    expect(titles(result)).toEqual(['Essay draft'])
  })

  it('ORs values inside one dimension', () => {
    const result = applyFilters(all, { ...EMPTY_FILTERS, priorities: ['high', 'low'] })
    expect(titles(result).sort()).toEqual(['Essay draft', 'Quarterly report'])
  })

  it('filters by status, tag and date range (excluding undated)', () => {
    expect(titles(applyFilters(all, { ...EMPTY_FILTERS, statuses: ['done'] }))).toEqual(['Read chapter'])
    expect(titles(applyFilters(all, { ...EMPTY_FILTERS, tags: ['english'] }))).toEqual(['Essay draft'])
    const ranged = applyFilters(all, { ...EMPTY_FILTERS, from: '2026-09-23', to: '2026-09-23' })
    expect(titles(ranged)).toEqual(['Quarterly report'])
  })

  it('fuzzy-searches title, notes and tags', () => {
    expect(titles(applyFilters(all, { ...EMPTY_FILTERS, query: 'essy' }))).toEqual(['Essay draft'])
    expect(titles(applyFilters(all, { ...EMPTY_FILTERS, query: 'finance' }))).toEqual(['Quarterly report'])
    expect(titles(applyFilters(all, { ...EMPTY_FILTERS, query: 'english' }))).toEqual(['Essay draft'])
  })

  it('counts active filter dimensions', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
    expect(activeFilterCount({ ...EMPTY_FILTERS, categoryIds: ['a'], from: '2026-01-01', query: 'x' })).toBe(3)
  })
})

describe('sortOccurrences / groupOccurrences', () => {
  it('sorts by due date with undated last, by priority, and by newest created', () => {
    expect(titles(sortOccurrences(all, 'due'))).toEqual(['Essay draft', 'Quarterly report', 'Read chapter', 'Someday idea'])
    expect(titles(sortOccurrences(all, 'priority'))[0]).toBe('Essay draft')
    expect(titles(sortOccurrences(all, 'created'))[0]).toBe('Someday idea')
  })

  it('groups by date with a trailing "No date" bucket', () => {
    const groups = groupOccurrences(sortOccurrences(all, 'due'), 'date', { categories, today: '2026-09-21' })
    expect(groups.map((group) => group.label)).toEqual(['Tomorrow', 'Wed, Sep 23', 'Thu, Sep 24', 'No date'])
  })

  it('groups by category in category order and by priority high-first', () => {
    const byCategory = groupOccurrences(all, 'category', { categories, today: '2026-09-21' })
    expect(byCategory.map((group) => group.label)).toEqual(['School', 'Work'])
    const byPriority = groupOccurrences(all, 'priority', { categories, today: '2026-09-21' })
    expect(byPriority.map((group) => group.key)).toEqual(['high', 'medium', 'low'])
  })
})

describe('My order', () => {
  const ordered = (orders: number[]) =>
    expandOccurrences(
      orders.map((sortOrder, index) => makeTask({ title: `T${index}`, categoryId: 'school', dueDate: '2026-09-22', sortOrder, createdAt: index })),
      '2026-09-22',
      '2026-09-22',
    )

  it('sorts by manual position, then due order for ties', () => {
    const list = ordered([3, 1, 2, 1])
    expect(titles(sortOccurrences(list, 'manual'))).toEqual(['T1', 'T3', 'T2', 'T0'])
  })

  it('moves a task to the midpoint of its new neighbors', () => {
    const list = ordered([1, 2, 3])
    const [, middle, last] = list
    expect(orderAfterMove(list, 2, 0)).toEqual([{ id: last?.task.id, sortOrder: 0 }])
    expect(orderAfterMove(list, 0, 1)).toEqual([{ id: list[0]?.task.id, sortOrder: 2.5 }])
    expect(orderAfterMove(list, 0, 2)).toEqual([{ id: list[0]?.task.id, sortOrder: 4 }])
    expect(middle && orderAfterMove(list, 1, 1)).toEqual([])
  })

  it('renumbers the list when the new neighbors tie', () => {
    const list = ordered([1, 1, 1])
    const updates = orderAfterMove(list, 2, 1)
    expect(updates.map((update) => update.sortOrder)).toEqual([1, 2, 3])
    expect(updates.map((update) => update.id)).toEqual([list[0]?.task.id, list[2]?.task.id, list[1]?.task.id])
  })

  it('ignores other occurrences of the same recurring task as neighbors', () => {
    const daily = makeTask({ title: 'Daily', categoryId: 'school', dueDate: '2026-09-22', sortOrder: 5, recurrence: { kind: 'daily', weekdays: [], until: null } })
    const other = makeTask({ title: 'Other', categoryId: 'school', dueDate: '2026-09-22', sortOrder: 7 })
    const list = sortOccurrences(expandOccurrences([daily, other], '2026-09-22', '2026-09-23'), 'manual')
    // [Daily 22, Daily 23, Other]: dragging the first Daily below Other puts it after Other.
    expect(orderAfterMove(list, 0, 2)).toEqual([{ id: daily.id, sortOrder: 8 }])
  })

  it('puts new tasks after everything else', () => {
    expect(nextSortOrder([])).toBe(1)
    expect(nextSortOrder(ordered([4, 9, 2]).map((occ) => occ.task))).toBe(10)
  })
})

describe('dropIndex (phone drag)', () => {
  const rows = [60, 60, 80, 60]

  it('stays put for small moves and lands past a neighbor once its midpoint is crossed', () => {
    expect(dropIndex(rows, 0, 20)).toEqual({ offset: 20, to: 0 })
    expect(dropIndex(rows, 0, 61)).toEqual({ offset: 61, to: 1 })
    // Row 3's top starts at 200; row 2's midpoint is 160, row 1's is 90.
    expect(dropIndex(rows, 3, -30)).toEqual({ offset: -30, to: 3 })
    expect(dropIndex(rows, 3, -60)).toEqual({ offset: -60, to: 2 })
    expect(dropIndex(rows, 3, -71)).toEqual({ offset: -71, to: 2 })
    expect(dropIndex(rows, 3, -141)).toEqual({ offset: -141, to: 1 })
  })

  it('keeps the dragged row inside the list', () => {
    expect(dropIndex(rows, 0, -50)).toEqual({ offset: 0, to: 0 })
    expect(dropIndex(rows, 0, 999)).toEqual({ offset: 200, to: 3 })
    expect(dropIndex(rows, 3, -999)).toEqual({ offset: -200, to: 0 })
  })
})
