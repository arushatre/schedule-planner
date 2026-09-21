import { describe, expect, it } from 'vitest'

import { EMPTY_FILTERS, activeFilterCount, applyFilters, groupOccurrences, sortOccurrences } from './filters'
import { expandOccurrences, undatedOccurrences } from './recurrence'
import { makeTask } from './tasks'
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
