import { describe, expect, it } from 'vitest'

import { completionsByCategory } from './analytics'
import { makeTask } from './tasks'
import type { Category, Task } from '@/types/model'

const categories: Category[] = [
  { id: 'school', name: 'School', colorKey: 'slate', archived: false, order: 0, createdAt: 0 },
  { id: 'work', name: 'Work', colorKey: 'clay', archived: false, order: 1, createdAt: 0 },
]
const today = '2026-09-21' // Monday
const at = (date: string) => new Date(`${date}T12:00:00`).getTime()
const doneOn = (categoryId: string, date: string): Task =>
  makeTask({ title: 'x', categoryId, status: 'done', completedAt: at(date) })

describe('completionsByCategory', () => {
  it('returns one bucket per week, oldest first, ending with the current week', () => {
    const { weeks } = completionsByCategory([], categories, today, 4)
    expect(weeks.map((week) => week.start)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'])
  })

  it('buckets completions into Monday-based weeks by category', () => {
    const tasks = [
      doneOn('school', '2026-09-21'), // Mon: current week
      doneOn('school', '2026-09-27'), // Sun: still the current week
      doneOn('work', '2026-09-20'), // Sun: previous week
      doneOn('work', '2026-09-14'), // Mon: previous week
    ]
    const { weeks, total } = completionsByCategory(tasks, categories, today, 2)
    expect(weeks[1]?.counts).toEqual({ school: 2 })
    expect(weeks[0]?.counts).toEqual({ work: 2 })
    expect(total).toBe(4)
  })

  it('ignores completions outside the window and unfinished tasks', () => {
    const tasks = [
      doneOn('school', '2026-01-05'),
      makeTask({ title: 'open', categoryId: 'school', dueDate: today }),
    ]
    const result = completionsByCategory(tasks, categories, today, 4)
    expect(result.total).toBe(0)
    expect(result.categories).toEqual([])
  })

  it('counts each completed occurrence of a recurring task', () => {
    const habit = makeTask({
      title: 'Read',
      categoryId: 'school',
      dueDate: '2026-09-01',
      recurrence: { kind: 'daily', weekdays: [], until: null },
      completedDates: ['2026-09-21', '2026-09-22', '2026-09-15'],
    })
    const { weeks } = completionsByCategory([habit], categories, today, 2)
    expect(weeks[1]?.total).toBe(2)
    expect(weeks[0]?.total).toBe(1)
  })

  it('ranks categories by total and maps unknown ids to Uncategorized', () => {
    const tasks = [doneOn('work', today), doneOn('work', today), doneOn('school', today), doneOn('ghost', today)]
    const { categories: ranked, max } = completionsByCategory(tasks, categories, today, 1)
    expect(ranked.map((entry) => [entry.category.name, entry.total])).toEqual([
      ['Work', 2],
      ['School', 1],
      ['Uncategorized', 1],
    ])
    expect(max).toBe(4)
  })

  it('keeps max at 1 when there is no data', () => {
    expect(completionsByCategory([], categories, today, 3).max).toBe(1)
  })
})
