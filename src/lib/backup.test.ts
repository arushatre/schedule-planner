import { describe, expect, it } from 'vitest'

import { parseBackup, serializeBackup } from './backup'
import { buildIcs } from './ics'
import { makeTask } from './tasks'
import type { Category, ClassBlock } from '@/types/model'

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
    const block: ClassBlock = {
      id: 'b1',
      title: 'Math',
      location: 'Room 12',
      weekdays: [1, 3, 5],
      startTime: '09:00',
      endTime: '09:50',
      colorKey: 'plum',
      createdAt: 5,
    }
    const restored = parseBackup(serializeBackup({ tasks: [task], categories, classBlocks: [block] }))
    expect(restored.tasks).toEqual([task])
    expect(restored.categories).toEqual(categories)
    expect(restored.classBlocks).toEqual([block])
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

  it('collapses duplicate ids instead of failing the whole import', () => {
    const text = JSON.stringify({
      tasks: [
        { id: 'a', title: 'First' },
        { id: 'a', title: 'Second' },
      ],
      categories: [
        { id: 'c', name: 'One' },
        { id: 'c', name: 'Two' },
      ],
    })
    const { tasks, categories: cats } = parseBackup(text)
    expect(tasks.map((task) => task.title)).toEqual(['Second'])
    expect(cats.map((category) => category.name)).toEqual(['Two'])
  })

  it('accepts version 1 backups without a schedule and drops invalid blocks', () => {
    const legacy = parseBackup(JSON.stringify({ version: 1, tasks: [], categories: [] }))
    expect(legacy.classBlocks).toEqual([])
    const withBad = parseBackup(
      JSON.stringify({
        tasks: [],
        categories: [],
        classBlocks: [{ id: 'x', title: 'No times' }, { id: 'y', title: 'Ok', startTime: '10:00', endTime: '11:00', weekdays: [2, 9] }],
      }),
    )
    expect(withBad.classBlocks).toHaveLength(1)
    expect(withBad.classBlocks[0]?.weekdays).toEqual([2])
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

  it('exports class blocks as weekly recurring events starting on a matching weekday', () => {
    const ics = buildIcs(
      [],
      categories,
      new Date('2026-09-21T12:00:00Z'), // Monday
      [
        { id: 'c', title: 'Chem, lab', location: 'Hall B', weekdays: [2, 4], startTime: '13:00', endTime: '14:30', colorKey: 'teal', createdAt: 1 },
      ],
    )
    expect(ics).toContain('UID:class-c@daybook')
    expect(ics).toContain('DTSTART:20260922T130000') // first Tuesday on/after the Monday
    expect(ics).toContain('DTEND:20260922T143000')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU,TH')
    expect(ics).toContain('SUMMARY:Chem\\, lab')
    expect(ics).toContain('LOCATION:Hall B')
  })

  it('folds long lines to 75 characters', () => {
    const ics = buildIcs([makeTask({ title: 'x'.repeat(200), categoryId: 'c1', dueDate: '2026-09-22' })], categories, now)
    expect(ics.split('\r\n').every((line) => line.length <= 75)).toBe(true)
  })
})
