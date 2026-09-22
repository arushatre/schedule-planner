import { describe, expect, it } from 'vitest'

import { MAX_LATE_MINUTES, dueReminders, reminderKey } from './reminders'
import { expandOccurrences } from './recurrence'
import { makeTask } from './tasks'

const today = '2026-09-21'
const at = (h: number, m = 0) => new Date(2026, 8, 21, h, m)
const occs = (...overrides: Parameters<typeof makeTask>[0][]) =>
  expandOccurrences(overrides.map((o) => makeTask(o)), today, today)
const base = { title: 'Call', categoryId: 'c', dueDate: today }

describe('dueReminders', () => {
  it('fires once the reminder time has arrived, not before', () => {
    const list = occs({ ...base, reminderTime: '09:30' })
    expect(dueReminders(list, at(9, 29), today, new Set())).toHaveLength(0)
    expect(dueReminders(list, at(9, 30), today, new Set())).toHaveLength(1)
    expect(dueReminders(list, at(10, 15), today, new Set())).toHaveLength(1)
  })

  it('skips reminders that are too old instead of firing them late', () => {
    const list = occs({ ...base, reminderTime: '08:00' })
    expect(dueReminders(list, at(8, MAX_LATE_MINUTES), today, new Set())).toHaveLength(1)
    expect(dueReminders(list, at(8, MAX_LATE_MINUTES + 1), today, new Set())).toHaveLength(0)
  })

  it('does not repeat a reminder that already fired', () => {
    const list = occs({ ...base, reminderTime: '09:00' })
    const fired = new Set([reminderKey(list[0]!)])
    expect(dueReminders(list, at(9, 5), today, fired)).toHaveLength(0)
  })

  it('re-arms if the reminder time is edited', () => {
    const before = occs({ ...base, id: 't', reminderTime: '09:00' })
    const fired = new Set([reminderKey(before[0]!)])
    const after = occs({ ...base, id: 't', reminderTime: '09:30' })
    expect(dueReminders(after, at(9, 40), today, fired)).toHaveLength(1)
  })

  it('ignores finished tasks, tasks without reminders, and other days', () => {
    const list = occs(
      { ...base, reminderTime: '09:00', status: 'done' },
      { ...base, reminderTime: null },
      { ...base, dueDate: '2026-09-22', reminderTime: '09:00' },
    )
    expect(dueReminders(list, at(9, 30), today, new Set())).toHaveLength(0)
  })

  it('handles recurring tasks per occurrence', () => {
    const habit = makeTask({
      ...base,
      recurrence: { kind: 'daily', weekdays: [], until: null },
      reminderTime: '07:00',
      completedDates: [today],
    })
    // Today's occurrence is done, so no reminder even though the series continues.
    expect(dueReminders(expandOccurrences([habit], today, today), at(7, 10), today, new Set())).toHaveLength(0)
  })
})
