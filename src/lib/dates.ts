import { addDays, eachDayOfInterval, format, isValid, parse, parseISO } from 'date-fns'

export const DATE_FORMAT = 'yyyy-MM-dd'
/** Weeks start on Monday. */
export const WEEK_OPTIONS = { weekStartsOn: 1 } as const

export function toDateStr(date: Date): string {
  return format(date, DATE_FORMAT)
}

/** Parses a local YYYY-MM-DD string to local midnight. */
export function fromDateStr(value: string): Date {
  return parseISO(value)
}

export function isDateStr(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

export function todayStr(): string {
  return toDateStr(new Date())
}

export function shiftDate(value: string, days: number): string {
  return toDateStr(addDays(fromDateStr(value), days))
}

/** Every date from `from` through `to` inclusive. */
export function daysBetween(from: string, to: string): string[] {
  if (from > to) return []
  return eachDayOfInterval({ start: fromDateStr(from), end: fromDateStr(to) }).map(toDateStr)
}

export function formatTime(value: string): string {
  return format(parse(value, 'HH:mm', new Date()), 'h:mm a')
}

export function friendlyDate(value: string, today: string = todayStr()): string {
  if (value === today) return 'Today'
  if (value === shiftDate(today, 1)) return 'Tomorrow'
  if (value === shiftDate(today, -1)) return 'Yesterday'
  const sameYear = value.slice(0, 4) === today.slice(0, 4)
  return format(fromDateStr(value), sameYear ? 'EEE, MMM d' : 'EEE, MMM d, yyyy')
}

/** 15-minute slots for time pickers. */
export const TIME_SLOTS: string[] = Array.from({ length: 96 }, (_, index) => {
  const hours = String(Math.floor(index / 4)).padStart(2, '0')
  const minutes = String((index % 4) * 15).padStart(2, '0')
  return `${hours}:${minutes}`
})
