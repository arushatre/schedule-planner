import { describe, expect, it } from 'vitest'

import { makeTask } from './tasks'
import { expandOccurrences, isOverdue, undatedOccurrences } from './recurrence'
import type { Task } from '@/types/model'

const base = { title: 'T', categoryId: 'c1' }
const dates = (task: Task, from: string, to: string) =>
  expandOccurrences([task], from, to).map((occ) => occ.date)

describe('expandOccurrences', () => {
  it('places a one-off task only inside the range', () => {
    const task = makeTask({ ...base, dueDate: '2026-09-21' })
    expect(dates(task, '2026-09-20', '2026-09-22')).toEqual(['2026-09-21'])
    expect(dates(task, '2026-09-22', '2026-09-30')).toEqual([])
  })

  it('expands daily tasks and respects the until date', () => {
    const task = makeTask({
      ...base,
      dueDate: '2026-09-21',
      recurrence: { kind: 'daily', weekdays: [], until: '2026-09-23' },
    })
    expect(dates(task, '2026-09-19', '2026-09-30')).toEqual(['2026-09-21', '2026-09-22', '2026-09-23'])
  })

  it('expands weekly tasks on the anchor weekday', () => {
    const task = makeTask({
      ...base,
      dueDate: '2026-09-21', // Monday
      recurrence: { kind: 'weekly', weekdays: [], until: null },
    })
    expect(dates(task, '2026-09-21', '2026-10-12')).toEqual([
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ])
  })

  it('expands custom weekday patterns (Mon/Wed/Fri)', () => {
    const task = makeTask({
      ...base,
      dueDate: '2026-09-21',
      recurrence: { kind: 'weekdays', weekdays: [1, 3, 5], until: null },
    })
    expect(dates(task, '2026-09-21', '2026-09-27')).toEqual(['2026-09-21', '2026-09-23', '2026-09-25'])
  })

  it('clamps monthly tasks anchored on the 31st to the last day of short months', () => {
    const task = makeTask({
      ...base,
      dueDate: '2026-01-31',
      recurrence: { kind: 'monthly', weekdays: [], until: null },
    })
    expect(dates(task, '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ])
  })

  it('never generates occurrences before the due date', () => {
    const task = makeTask({
      ...base,
      dueDate: '2026-09-21',
      recurrence: { kind: 'daily', weekdays: [], until: null },
    })
    expect(dates(task, '2026-09-01', '2026-09-22')).toEqual(['2026-09-21', '2026-09-22'])
  })

  it('tracks completion per occurrence for recurring tasks', () => {
    const task = makeTask({
      ...base,
      dueDate: '2026-09-21',
      recurrence: { kind: 'daily', weekdays: [], until: null },
      completedDates: ['2026-09-22'],
    })
    const done = expandOccurrences([task], '2026-09-21', '2026-09-23').map((occ) => occ.done)
    expect(done).toEqual([false, true, false])
  })

  it('moves a single occurrence via exceptions without touching the series', () => {
    const task = makeTask({
      ...base,
      dueDate: '2026-09-21',
      recurrence: { kind: 'daily', weekdays: [], until: null },
      exceptions: { '2026-09-22': '2026-09-25' },
    })
    const occs = expandOccurrences([task], '2026-09-21', '2026-09-25')
    expect(occs.map((occ) => occ.date)).toEqual(['2026-09-21', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-25'])
    const moved = occs.find((occ) => occ.originalDate === '2026-09-22')
    expect(moved?.date).toBe('2026-09-25')
  })

  it('shows a moved occurrence when only its new date is in range', () => {
    const task = makeTask({
      ...base,
      dueDate: '2026-09-21',
      recurrence: { kind: 'weekly', weekdays: [], until: null },
      exceptions: { '2026-09-28': '2026-10-15' },
    })
    // Oct 12 and Oct 19 are ordinary Mondays; Oct 15 is the dragged Sep 28 occurrence.
    expect(dates(task, '2026-10-10', '2026-10-20').sort()).toEqual(['2026-10-12', '2026-10-15', '2026-10-19'])
    // The original slot is empty now.
    expect(dates(task, '2026-09-28', '2026-09-28')).toEqual([])
  })
})

describe('helpers', () => {
  it('flags overdue only for unfinished, past occurrences', () => {
    const task = makeTask({ ...base, dueDate: '2026-09-20' })
    const [occ] = expandOccurrences([task], '2026-09-01', '2026-09-30')
    if (!occ) throw new Error('expected an occurrence')
    expect(isOverdue(occ, '2026-09-21')).toBe(true)
    expect(isOverdue({ ...occ, done: true }, '2026-09-21')).toBe(false)
    expect(isOverdue(occ, '2026-09-20')).toBe(false)
  })

  it('returns tasks without a due date as undated occurrences', () => {
    const task = makeTask(base)
    expect(undatedOccurrences([task])).toHaveLength(1)
    expect(expandOccurrences([task], '2026-01-01', '2026-12-31')).toHaveLength(0)
  })
})
