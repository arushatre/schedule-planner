import { describe, expect, it } from 'vitest'

import { blocksOn, formatBlockTimes, formatWeekdays, isValidBlockTimes } from './schedule'
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
