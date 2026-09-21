import { addDays, addHours, format, parse } from 'date-fns'

import type { Category, Task } from '@/types/model'
import { fromDateStr, toDateStr } from './dates'
import { isRecurring } from './recurrence'

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** RFC 5545 line folding (by characters; good enough for typical task text). */
function fold(line: string): string {
  if (line.length <= 74) return line
  const parts = [line.slice(0, 74)]
  for (let index = 74; index < line.length; index += 73) parts.push(` ${line.slice(index, index + 73)}`)
  return parts.join('\r\n')
}

const compactDate = (date: string) => date.replace(/-/g, '')

function localDateTime(date: string, time: string): Date {
  return parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date())
}

function stamp(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss")
}

function rrule(task: Task): string | null {
  if (!isRecurring(task)) return null
  const { kind, weekdays, until } = task.recurrence
  const parts: string[] = []
  switch (kind) {
    case 'daily':
      parts.push('FREQ=DAILY')
      break
    case 'weekly':
      parts.push('FREQ=WEEKLY')
      break
    case 'weekdays':
      parts.push('FREQ=WEEKLY', `BYDAY=${weekdays.map((day) => BYDAY[day]).join(',')}`)
      break
    case 'monthly':
      parts.push('FREQ=MONTHLY')
      break
    default:
      return null
  }
  if (until) {
    parts.push(`UNTIL=${task.dueTime ? `${compactDate(until)}T235959` : compactDate(until)}`)
  }
  return parts.join(';')
}

function timing(task: Task, date: string): string[] {
  if (task.dueTime) {
    const start = localDateTime(date, task.dueTime)
    return [`DTSTART:${stamp(start)}`, `DTEND:${stamp(addHours(start, 1))}`]
  }
  const next = toDateStr(addDays(fromDateStr(date), 1))
  return [`DTSTART;VALUE=DATE:${compactDate(date)}`, `DTEND;VALUE=DATE:${compactDate(next)}`]
}

function description(task: Task): string {
  const lines = [task.notes.trim()]
  if (task.subtasks.length) {
    lines.push(task.subtasks.map((sub) => `${sub.done ? '[x]' : '[ ]'} ${sub.title}`).join('\n'))
  }
  return lines.filter(Boolean).join('\n\n')
}

function event(
  task: Task,
  categoryName: string | undefined,
  uid: string,
  date: string,
  now: string,
  extra: string[] = [],
): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${uid}@daybook`, `DTSTAMP:${now}`, ...timing(task, date)]
  lines.push(`SUMMARY:${escapeText(task.title)}`)
  const text = description(task)
  if (text) lines.push(`DESCRIPTION:${escapeText(text)}`)
  const labels = [categoryName, ...task.tags].filter((value): value is string => Boolean(value))
  if (labels.length) lines.push(`CATEGORIES:${labels.map(escapeText).join(',')}`)
  lines.push(...extra, 'END:VEVENT')
  return lines
}

/** Builds an iCalendar file with one event per dated task (RRULE for repeats). */
export function buildIcs(tasks: Task[], categories: Category[], now: Date = new Date()): string {
  // DTSTAMP is always UTC (e.g. 20260921T231500Z).
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daybook//Tasks//EN', 'CALSCALE:GREGORIAN']

  for (const task of tasks) {
    if (!task.dueDate) continue
    const categoryName = categories.find((category) => category.id === task.categoryId)?.name
    const extra: string[] = []
    const rule = rrule(task)
    if (rule) extra.push(`RRULE:${rule}`)

    const moved = Object.entries(task.exceptions)
    for (const [original] of moved) {
      extra.push(
        task.dueTime
          ? `EXDATE:${stamp(localDateTime(original, task.dueTime))}`
          : `EXDATE;VALUE=DATE:${compactDate(original)}`,
      )
    }
    lines.push(...event(task, categoryName, task.id, task.dueDate, dtstamp, extra))

    for (const [original, target] of moved) {
      lines.push(...event(task, categoryName, `${task.id}-moved-${original}`, target, dtstamp))
    }
  }

  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}
