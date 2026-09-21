import { describe, expect, it } from 'vitest'

import { parseBackup, serializeBackup } from './backup'
import { buildIcs } from './ics'
import { makeTask } from './tasks'
import type { Category } from '@/types/model'

const categories: Category[] = [
  { id: 'c1', name: 'School', colorKey: 'slate', archived: false, order: 0, createdAt: 1 },
]

describe('backup', () => {
  it('round-trips tasks and categories', () => {
    const task = makeTask({
      title: 'Essay',
      categoryId: 'c1',
      dueDate: '2026-09-25',
      dueTime: '17:00',
      tags: ['english'],
      subtasks: [{ id: 's1', title: 'Outline', done: true }],
      recurrence: { kind: 'weekdays', weekdays: [1, 3], until: '2026-12-01' },
      exceptions: { '2026-09-28': '2026-09-29' },
      completedDates: ['2026-09-25'],
    })
    const restored = parseBackup(serializeBackup({ tasks: [task], categories }))
    expect(restored.tasks).toEqual([task])
    expect(restored.categories).toEqual(categories)
  })

  it('rejects non-JSON and unrelated JSON with readable errors', () => {
    expect(() => parseBackup('nope')).toThrow('not valid JSON')
    expect(() => parseBackup('{"hello":1}')).toThrow('does not look like')
  })

  it('drops malformed rows and repairs bad field values instead of crashing', () => {
    const text = JSON.stringify({
      tasks: [
        { id: 'a', title: '  Ok  ', priority: 'urgent', dueDate: 'tomorrow', tags: ['x', 5] },
        { id: 'b', title: '' },
        'garbage',
      ],
      categories: [{ id: 'c', name: 'Cat', colorKey: 'hotpink' }, { nope: true }],
    })
    const { tasks, categories: cats } = parseBackup(text)
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ title: 'Ok', priority: 'medium', dueDate: null, tags: ['x'] })
    expect(cats).toHaveLength(1)
    expect(cats[0]?.colorKey).toBe('graphite')
  })
})

describe('buildIcs', () => {
  const now = new Date('2026-09-21T12:00:00Z')

  it('emits all-day and timed events with escaped text', () => {
    const ics = buildIcs(
      [
        makeTask({ title: 'Buy milk, eggs', categoryId: 'c1', dueDate: '2026-09-22', id: 'a' }),
        makeTask({ title: 'Call', categoryId: 'c1', dueDate: '2026-09-22', dueTime: '17:30', id: 'b' }),
      ],
      categories,
      now,
    )
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:Buy milk\\, eggs')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260922')
    expect(ics).toContain('DTEND;VALUE=DATE:20260923')
    expect(ics).toContain('DTSTART:20260922T173000')
    expect(ics).toContain('DTEND:20260922T183000')
    expect(ics).toContain('DTSTAMP:20260921T120000Z')
    expect(ics).toContain('CATEGORIES:School')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('maps recurrence to RRULE and skips undated tasks', () => {
    const ics = buildIcs(
      [
        makeTask({
          id: 'r',
          title: 'Math',
          categoryId: 'c1',
          dueDate: '2026-09-21',
          recurrence: { kind: 'weekdays', weekdays: [1, 3, 5], until: '2026-12-18' },
          exceptions: { '2026-09-23': '2026-09-24' },
        }),
        makeTask({ title: 'No date', categoryId: 'c1' }),
      ],
      categories,
      now,
    )
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261218')
    expect(ics).toContain('EXDATE;VALUE=DATE:20260923')
    expect(ics).toContain('UID:r-moved-2026-09-23@daybook')
    expect(ics).not.toContain('No date')
  })

  it('folds long lines to 75 characters', () => {
    const ics = buildIcs([makeTask({ title: 'x'.repeat(200), categoryId: 'c1', dueDate: '2026-09-22' })], categories, now)
    expect(ics.split('\r\n').every((line) => line.length <= 75)).toBe(true)
  })
})
