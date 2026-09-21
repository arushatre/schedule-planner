import { describe, expect, it } from 'vitest'

import { computeStats } from './stats'
import { makeTask } from './tasks'
import type { Task } from '@/types/model'

const at = (date: string) => new Date(`${date}T12:00:00`).getTime()
const doneOn = (date: string): Task =>
  makeTask({ title: 'x', categoryId: 'c', status: 'done', completedAt: at(date) })

describe('computeStats', () => {
  const today = '2026-09-21' // Monday

  it('counts today and this week (weeks start Monday)', () => {
    const tasks = [doneOn('2026-09-21'), doneOn('2026-09-21'), doneOn('2026-09-20'), doneOn('2026-09-15')]
    const stats = computeStats(tasks, today)
    expect(stats.doneToday).toBe(2)
    expect(stats.doneThisWeek).toBe(2) // Sunday the 20th belongs to the previous week
  })

  it('counts a streak of consecutive days including today', () => {
    const tasks = [doneOn('2026-09-21'), doneOn('2026-09-20'), doneOn('2026-09-19'), doneOn('2026-09-17')]
    expect(computeStats(tasks, today).streak).toBe(3)
  })

  it('does not break the streak while today is still in progress', () => {
    const tasks = [doneOn('2026-09-20'), doneOn('2026-09-19')]
    expect(computeStats(tasks, today).streak).toBe(2)
  })

  it('is zero once a full day was missed', () => {
    expect(computeStats([doneOn('2026-09-19')], today).streak).toBe(0)
  })

  it('uses per-occurrence completion dates for recurring tasks', () => {
    const habit = makeTask({
      title: 'Read',
      categoryId: 'c',
      dueDate: '2026-09-01',
      recurrence: { kind: 'daily', weekdays: [], until: null },
      completedDates: ['2026-09-21', '2026-09-20'],
    })
    const stats = computeStats([habit], today)
    expect(stats.streak).toBe(2)
    expect(stats.doneToday).toBe(1)
  })
})
