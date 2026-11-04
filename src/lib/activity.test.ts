import { describe, expect, it } from 'vitest'

import { activeDays, activityByDay, currentRun, streakRuns, streakTier } from './activity'
import { makeTask } from './tasks'

const at = (local: string) => new Date(local).getTime()

describe('streak history', () => {
  it('groups events into local days, times ascending', () => {
    const byDay = activityByDay([
      { id: '2', at: at('2026-11-04T22:30:00'), kind: 'task' },
      { id: '1', at: at('2026-11-04T08:05:00'), kind: 'task' },
      { id: '3', at: at('2026-11-05T00:10:00'), kind: 'task' },
    ])
    expect([...byDay.keys()]).toEqual(['2026-11-04', '2026-11-05'])
    expect(byDay.get('2026-11-04')).toEqual([at('2026-11-04T08:05:00'), at('2026-11-04T22:30:00')])
  })

  it('counts finished tasks as active days, so old history still shows', () => {
    const done = { ...makeTask({ title: 'Old', categoryId: '' }), status: 'done' as const, completedAt: at('2026-10-01T12:00:00') }
    expect([...activeDays([], [done])]).toEqual(['2026-10-01'])
  })

  it('finds runs, the gaps between them, and the current streak', () => {
    const runs = streakRuns(new Set(['2026-11-01', '2026-10-28', '2026-10-27', '2026-11-02', '2026-11-03']))
    expect(runs).toEqual([
      { start: '2026-10-27', end: '2026-10-28', days: 2, gapBefore: null },
      { start: '2026-11-01', end: '2026-11-03', days: 3, gapBefore: 3 },
    ])
    // Yesterday still counts until today ends; two days ago does not.
    expect(currentRun(runs, '2026-11-04')?.days).toBe(3)
    expect(currentRun(runs, '2026-11-05')).toBeNull()
  })

  it('handles month and leap-day boundaries', () => {
    expect(streakRuns(new Set(['2028-02-28', '2028-02-29', '2028-03-01']))).toHaveLength(1)
  })

  it('gets livelier as the streak grows; fireworks start after 5 days', () => {
    expect([0, 1, 2, 5, 6, 29, 30].map(streakTier)).toEqual([0, 1, 2, 2, 3, 3, 4])
  })
})
