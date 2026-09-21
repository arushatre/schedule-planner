import { getDay } from 'date-fns'

import type { ClassBlock } from '@/types/model'
import { formatTime, fromDateStr } from './dates'

/** Class blocks that meet on `date`, earliest first. */
export function blocksOn(blocks: ClassBlock[], date: string): ClassBlock[] {
  const weekday = getDay(fromDateStr(date))
  return blocks
    .filter((block) => block.weekdays.includes(weekday))
    .sort((a, b) => (a.startTime === b.startTime ? a.title.localeCompare(b.title) : a.startTime < b.startTime ? -1 : 1))
}

export function isValidBlockTimes(startTime: string, endTime: string): boolean {
  return startTime < endTime
}

export function formatBlockTimes(block: ClassBlock): string {
  return `${formatTime(block.startTime)} – ${formatTime(block.endTime)}`
}

const DAY_LETTERS = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa']

/** "MWF", "Tu Th", ... in Monday-first order. */
export function formatWeekdays(weekdays: number[]): string {
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((day) => weekdays.includes(day))
    .map((day) => DAY_LETTERS[day])
    .join(' ')
}
