import { describe, expect, it } from 'vitest'

import { blocksOn, formatBlockTimes, formatWeekdays, isValidBlockTimes, laneBox, layoutLanes } from './schedule'
import type { ClassBlock } from '@/types/model'

const block = (over: Partial<ClassBlock>): ClassBlock => ({
  id: 'x',
  title: 'Class',
  location: '',
  weekdays: [1],
  startTime: '09:00',
  endTime: '09:50',
  colorKey: 'slate',
  createdAt: 0,
  ...over,
})

describe('schedule', () => {
  const blocks = [
    block({ id: 'a', title: 'Math', weekdays: [1, 3, 5], startTime: '09:00' }),
    block({ id: 'b', title: 'Art', weekdays: [1], startTime: '08:00', endTime: '08:50' }),
    block({ id: 'c', title: 'Lab', weekdays: [2, 4], startTime: '13:00', endTime: '14:00' }),
  ]

  it('returns the blocks meeting on a date, earliest first', () => {
    // 2026-09-21 is a Monday
    expect(blocksOn(blocks, '2026-09-21').map((b) => b.title)).toEqual(['Art', 'Math'])
    expect(blocksOn(blocks, '2026-09-22').map((b) => b.title)).toEqual(['Lab'])
    expect(blocksOn(blocks, '2026-09-26')).toEqual([]) // Saturday
  })

  it('validates and formats times and weekdays', () => {
    expect(isValidBlockTimes('09:00', '09:50')).toBe(true)
    expect(isValidBlockTimes('10:00', '10:00')).toBe(false)
    expect(isValidBlockTimes('11:00', '10:00')).toBe(false)
    expect(formatBlockTimes(block({}))).toBe('9:00 AM – 9:50 AM')
    expect(formatWeekdays([5, 1, 3])).toBe('M W F')
    expect(formatWeekdays([0, 6, 2])).toBe('Tu Sa Su')
  })
})

describe('layoutLanes', () => {
  const span = (start: number, end: number) => ({ start, end })

  it('keeps separate and touching items in one full-width lane', () => {
    expect(layoutLanes([span(0, 60), span(60, 120), span(200, 230)])).toEqual([
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
    ])
  })

  it('puts overlapping items side by side, in input order', () => {
    expect(layoutLanes([span(30, 90), span(0, 60), span(500, 545)])).toEqual([
      { lane: 1, lanes: 2 },
      { lane: 0, lanes: 2 },
      { lane: 0, lanes: 1 },
    ])
  })

  it('reuses a freed lane within a chain of overlaps', () => {
    // A 0-60 overlaps B 30-120; C 70-100 starts after A ends, so it reuses lane 0.
    expect(layoutLanes([span(0, 60), span(30, 120), span(70, 100)])).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
      { lane: 0, lanes: 2 },
    ])
  })

  it('half-overlaps neighbors across the width', () => {
    expect(laneBox({ lane: 0, lanes: 1 })).toEqual({ left: 0, width: 1 })
    expect(laneBox({ lane: 1, lanes: 2 })).toEqual({ left: 1 / 3, width: 2 / 3 })
    expect(laneBox({ lane: 2, lanes: 3 })).toEqual({ left: 0.5, width: 0.5 })
  })
})
