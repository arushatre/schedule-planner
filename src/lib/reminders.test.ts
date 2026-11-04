import { describe, expect, it } from 'vitest'

import { MAX_LATE_MINUTES, MAX_PLANNED, alertWindow, briefing, dueAlerts, planNotifications } from './reminders'
import { expandOccurrences } from './recurrence'
import { makeTask } from './tasks'

const today = '2026-09-21'
const at = (h: number, m = 0, day = 21) => new Date(2026, 8, day, h, m)
const occs = (...overrides: Parameters<typeof makeTask>[0][]) => {
  const { from, to } = alertWindow(today)
  return expandOccurrences(overrides.map((o) => makeTask(o)), from, to)
}
const base = { title: 'Call', categoryId: 'c', dueDate: today }
const none = new Set<string>()
const labels = (list: ReturnType<typeof occs>, now: Date, fired = none) => dueAlerts(list, now, fired).notify.map((a) => a.label)

describe('dueAlerts', () => {
  it('fires a reminder once its time arrives, not before', () => {
    const list = occs({ ...base, reminderTime: '09:30' })
    expect(labels(list, at(9, 29))).toEqual([])
    expect(labels(list, at(9, 30))).toEqual(['Reminder'])
  })

  it('fires each "before" alert relative to the due time', () => {
    const list = occs({ ...base, dueTime: '17:00', alerts: [0, 60, 1440] })
    expect(labels(list, at(16, 59, 20))).toEqual([])
    expect(labels(list, at(17, 0, 20))).toEqual(['Due in 1 day'])
    expect(labels(list, at(15, 59))).toEqual(['Due in 1 day'])
    // Catching up collapses to the latest alert but marks all of them handled.
    expect(labels(list, at(16, 0))).toEqual(['Due in 1 hr'])
    expect(dueAlerts(list, at(17, 0), none).fired).toHaveLength(3)
    expect(labels(list, at(17, 0))).toEqual(['Due now'])
  })

  it('treats untimed tasks as due at 9:00', () => {
    const list = occs({ ...base, dueDate: '2026-09-22', alerts: [1440] })
    expect(labels(list, at(8, 59))).toEqual([])
    expect(labels(list, at(9, 0))).toEqual(['Due in 1 day'])
  })

  it('catches up on alerts missed while closed if the task is still ahead', () => {
    const list = occs({ ...base, dueDate: '2026-09-23', dueTime: '12:00', alerts: [2880] })
    // Alert was at 12:00 on the 21st; app opened at 20:00, well past the late window.
    expect(labels(list, at(20, 0))).toEqual(['Due in 2 days'])
  })

  it('drops stale alerts once the task itself is past due', () => {
    const list = occs({ ...base, reminderTime: '08:00' })
    expect(labels(list, at(8, MAX_LATE_MINUTES))).toEqual(['Reminder'])
    expect(labels(list, at(9, MAX_LATE_MINUTES + 1))).toEqual([])
  })

  it('does not repeat an alert, but re-arms when its time is edited', () => {
    const before = occs({ ...base, id: 't', reminderTime: '09:00' })
    const fired = new Set(dueAlerts(before, at(9, 5), none).fired)
    expect(labels(before, at(9, 6), fired)).toEqual([])
    const after = occs({ ...base, id: 't', reminderTime: '09:30' })
    expect(labels(after, at(9, 40), fired)).toEqual(['Reminder'])
  })

  it('ignores finished tasks and finished recurring occurrences', () => {
    const list = occs(
      { ...base, reminderTime: '09:00', status: 'done' },
      { ...base, alerts: [0], recurrence: { kind: 'daily', weekdays: [], until: null }, completedDates: [today] },
    )
    expect(labels(list, at(9, 30))).toEqual([])
  })
})

describe('briefing', () => {
  it('summarizes today, overdue, next and tomorrow', () => {
    const tasks = [
      makeTask({ ...base, title: 'Essay', dueTime: '17:00' }),
      makeTask({ ...base, title: 'Read' }),
      makeTask({ ...base, title: 'Old', dueDate: '2026-09-19' }),
      makeTask({ ...base, title: 'Quiz', dueDate: '2026-09-22' }),
    ]
    expect(briefing(tasks, today)).toEqual({
      title: '2 due today',
      body: '1 overdue · Next: Essay at 5:00 PM · 1 due tomorrow',
    })
  })

  it('stays quiet on an empty schedule', () => {
    expect(briefing([], today)).toBeNull()
  })
})

describe('planNotifications', () => {
  it('queues future alerts and briefings soonest first, capped for iOS', () => {
    const tasks = [makeTask({ ...base, dueDate: '2026-09-22', dueTime: '17:00', alerts: [60, 1440] })]
    const plan = planNotifications(tasks, at(12, 0), true)
    expect(plan.map((n) => [n.date.getDate(), n.date.getHours(), n.title, n.body])).toEqual([
      [21, 17, 'Call', 'Due in 1 day'],
      [22, 7, '1 due today', 'Next: Call at 5:00 PM'],
      [22, 16, 'Call', 'Due in 1 hr'],
      [23, 7, 'Nothing due today', '1 overdue'],
    ])
    const many = Array.from({ length: 80 }, (_, i) => makeTask({ ...base, dueTime: '23:00', title: `T${i}`, alerts: [0] }))
    expect(planNotifications(many, at(12, 0), false)).toHaveLength(MAX_PLANNED)
  })
})
