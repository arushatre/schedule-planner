import { getDay } from 'date-fns'

import { PRIORITY_LABEL, STATUS_LABEL } from '@/types/model'
import type { ClassBlock, Task } from '@/types/model'
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

export interface Lane {
  /** 0 = leftmost. */
  lane: number
  /** Lanes used by this item's group of overlapping items. */
  lanes: number
}

/**
 * Lanes for timeline items that overlap in time: each item takes the first lane that is free at its
 * start. Items that only touch (one ends as the next starts) don't overlap.
 */
export function layoutLanes(spans: { start: number; end: number }[]): Lane[] {
  const items = spans.map((span) => ({ ...span, lane: 0, lanes: 1 }))
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  let group: typeof items = []
  let laneEnds: number[] = []
  let groupEnd = -Infinity
  const closeGroup = () => {
    for (const item of group) item.lanes = laneEnds.length
    group = []
    laneEnds = []
    groupEnd = -Infinity
  }
  for (const item of sorted) {
    if (item.start >= groupEnd) closeGroup()
    const free = laneEnds.findIndex((end) => end <= item.start)
    item.lane = free === -1 ? laneEnds.length : free
    laneEnds[item.lane] = item.end
    group.push(item)
    groupEnd = Math.max(groupEnd, item.end)
  }
  closeGroup()
  return items.map(({ lane, lanes }) => ({ lane, lanes }))
}

/**
 * Where an item sits across the timeline's width, as fractions. Neighbors overlap by half: with two
 * lanes each takes 2/3 of the width, the second starting a third of the way in.
 */
export function laneBox({ lane, lanes }: Lane): { left: number; width: number } {
  const step = 1 / (lanes + 1)
  return { left: lane * step, width: lanes === 1 ? 1 : 2 * step }
}

/** Lines for a task's hover (web) / long-press (phone) card on the timeline, below its title and time. */
export function taskInfo(task: Task, categoryName: string): string[] {
  const done = task.subtasks.filter((subtask) => subtask.done).length
  const notes = task.notes.trim().replace(/\s+/g, ' ')
  return [
    `${categoryName} · ${PRIORITY_LABEL[task.priority]} priority · ${STATUS_LABEL[task.status]}`,
    task.subtasks.length > 0 ? `${done} of ${task.subtasks.length} subtasks done` : '',
    task.tags.map((tag) => `#${tag}`).join(' '),
    notes.length > 140 ? `${notes.slice(0, 139)}…` : notes,
  ].filter(Boolean)
}
