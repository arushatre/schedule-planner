import { addDays, addMonths, addWeeks, getDay, isValid, nextDay } from 'date-fns'
import type { Day } from 'date-fns'

import type { Category, Priority, Recurrence } from '@/types/model'
import { fromDateStr, toDateStr } from './dates'

export interface ParsedQuickAdd {
  title: string
  dueDate: string | null
  dueTime: string | null
  tags: string[]
  categoryId: string | null
  priority: Priority | null
  recurrence: Recurrence | null
}

interface Context {
  /** Local YYYY-MM-DD used to resolve relative dates. */
  today: string
  categories: Category[]
}

const WEEKDAY = '(?:sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)'
const MONTH =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const weekdayIndex = (word: string) => WEEKDAY_NAMES.indexOf(word.slice(0, 3).toLowerCase())
const monthIndex = (word: string) => MONTH_NAMES.indexOf(word.slice(0, 3).toLowerCase())

/** Working copy of the input; recognised phrases are cut out as they're claimed. */
class Text {
  value: string

  constructor(value: string) {
    this.value = value
  }

  find(pattern: RegExp): RegExpExecArray | null {
    return pattern.exec(this.value)
  }

  cut(match: RegExpExecArray): void {
    this.value = `${this.value.slice(0, match.index)} ${this.value.slice(match.index + match[0].length)}`
  }
}

/** Nearest date on or after `from` that falls on `weekday`. */
function onOrAfter(from: Date, weekday: number): Date {
  return getDay(from) === weekday ? from : nextDay(from, weekday as Day)
}

function buildDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day)
  return isValid(date) && date.getMonth() === month && date.getDate() === day ? date : null
}

/** Month/day with no year means "the next one": roll to next year if already past. */
function resolveMonthDay(month: number, day: number, year: number | null, today: Date): Date | null {
  if (year !== null) return buildDate(year, month, day)
  const thisYear = buildDate(today.getFullYear(), month, day)
  if (!thisYear) return null
  return toDateStr(thisYear) < toDateStr(today) ? buildDate(today.getFullYear() + 1, month, day) : thisYear
}

function parseTime(text: Text): string | null {
  const meridiem = text.find(
    /(?:^|\s)(?:at\s+|@\s*)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z\d])/i,
  )
  if (meridiem) {
    const hour = Number(meridiem[1])
    const minute = Number(meridiem[2] ?? '0')
    if (hour >= 1 && hour <= 12 && minute <= 59) {
      text.cut(meridiem)
      const pm = (meridiem[3] ?? '').toLowerCase().startsWith('p')
      const hour24 = (hour % 12) + (pm ? 12 : 0)
      return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
  }
  const twentyFour = text.find(/(?:^|\s)(?:at\s+|@\s*)?([01]?\d|2[0-3]):([0-5]\d)(?!\d)/i)
  if (twentyFour) {
    text.cut(twentyFour)
    return `${String(Number(twentyFour[1])).padStart(2, '0')}:${twentyFour[2]}`
  }
  const named = text.find(/(?:^|\s)(?:at\s+)?(noon|midnight)(?![a-z])/i)
  if (named) {
    text.cut(named)
    return (named[1] ?? '').toLowerCase() === 'noon' ? '12:00' : '00:00'
  }
  return null
}

function parseRecurrence(text: Text): { recurrence: Recurrence; anchorWeekday: number | null } | null {
  const make = (kind: Recurrence['kind'], weekdays: number[] = []): Recurrence => ({ kind, weekdays, until: null })

  const weekday = text.find(/\bevery\s+weekday\b/i)
  if (weekday) {
    text.cut(weekday)
    return { recurrence: make('weekdays', [1, 2, 3, 4, 5]), anchorWeekday: null }
  }

  const list = text.find(new RegExp(`\\bevery\\s+(${WEEKDAY}(?:\\s*(?:,|/|&|and)?\\s*${WEEKDAY})*)(?![a-z])`, 'i'))
  if (list) {
    text.cut(list)
    const days = [...new Set([...(list[1] ?? '').matchAll(new RegExp(WEEKDAY, 'gi'))].map((m) => weekdayIndex(m[0])))]
    if (days.length === 1) return { recurrence: make('weekly'), anchorWeekday: days[0] ?? null }
    return { recurrence: make('weekdays', days.sort((a, b) => a - b)), anchorWeekday: null }
  }

  const every = text.find(/\bevery\s+(day|week|month)\b/i)
  if (every) {
    text.cut(every)
    const unit = (every[1] ?? '').toLowerCase()
    return { recurrence: make(unit === 'day' ? 'daily' : unit === 'week' ? 'weekly' : 'monthly'), anchorWeekday: null }
  }

  const adverb = text.find(/\b(daily|weekly|monthly)\b/i)
  if (adverb) {
    text.cut(adverb)
    const word = (adverb[1] ?? '').toLowerCase()
    return { recurrence: make(word === 'daily' ? 'daily' : word === 'weekly' ? 'weekly' : 'monthly'), anchorWeekday: null }
  }
  return null
}

function parseDate(text: Text, today: Date): Date | null {
  const iso = text.find(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) {
    const date = buildDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    if (date) {
      text.cut(iso)
      return date
    }
  }

  const monthFirst = text.find(new RegExp(`\\b(${MONTH})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?![\\d:])`, 'i'))
  if (monthFirst) {
    const date = resolveMonthDay(monthIndex(monthFirst[1] ?? ''), Number(monthFirst[2]), monthFirst[3] ? Number(monthFirst[3]) : null, today)
    if (date) {
      text.cut(monthFirst)
      return date
    }
  }

  const dayFirst = text.find(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})\\b(?:,?\\s+(\\d{4}))?`, 'i'))
  if (dayFirst) {
    const date = resolveMonthDay(monthIndex(dayFirst[2] ?? ''), Number(dayFirst[1]), dayFirst[3] ? Number(dayFirst[3]) : null, today)
    if (date) {
      text.cut(dayFirst)
      return date
    }
  }

  const numeric = text.find(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/])/)
  if (numeric) {
    const rawYear = numeric[3] ? Number(numeric[3]) : null
    const year = rawYear === null ? null : rawYear < 100 ? 2000 + rawYear : rawYear
    const date = resolveMonthDay(Number(numeric[1]) - 1, Number(numeric[2]), year, today)
    if (date) {
      text.cut(numeric)
      return date
    }
  }

  const relative = text.find(/\b(today|tonight|tomorrow|tmrw|tmr)\b/i)
  if (relative) {
    text.cut(relative)
    const word = (relative[1] ?? '').toLowerCase()
    return word === 'today' || word === 'tonight' ? today : addDays(today, 1)
  }

  const inN = text.find(/\bin\s+(\d{1,3})\s+(day|week|month)s?\b/i)
  if (inN) {
    text.cut(inN)
    const count = Number(inN[1])
    const unit = (inN[2] ?? '').toLowerCase()
    return unit === 'day' ? addDays(today, count) : unit === 'week' ? addWeeks(today, count) : addMonths(today, count)
  }

  const nextPeriod = text.find(/\bnext\s+(week|month)\b/i)
  if (nextPeriod) {
    text.cut(nextPeriod)
    return (nextPeriod[1] ?? '').toLowerCase() === 'week' ? addWeeks(today, 1) : addMonths(today, 1)
  }

  const nextWeekday = text.find(new RegExp(`\\bnext\\s+(${WEEKDAY})(?![a-z])`, 'i'))
  if (nextWeekday) {
    text.cut(nextWeekday)
    return nextDay(today, weekdayIndex(nextWeekday[1] ?? '') as Day)
  }

  const weekday = text.find(new RegExp(`\\b(?:this\\s+|on\\s+)?(${WEEKDAY})(?![a-z])`, 'i'))
  if (weekday) {
    text.cut(weekday)
    return onOrAfter(today, weekdayIndex(weekday[1] ?? ''))
  }

  return null
}

const DANGLING = /\s+(?:on|at|by|due|for|from|until|next|this|every)$/i
const LEADING = /^(?:on|at|by|due|for)\s+/i

/**
 * Turns "Essay draft fri 5pm #english !high" into structured fields.
 * Recognises dates, times, #tags/#categories, !priority and repeats; the rest is the title.
 */
export function parseQuickAdd(input: string, context: Context): ParsedQuickAdd {
  const raw = input.trim()
  const today = fromDateStr(context.today)
  const text = new Text(` ${raw} `)
  const result: ParsedQuickAdd = {
    title: raw,
    dueDate: null,
    dueTime: null,
    tags: [],
    categoryId: null,
    priority: null,
    recurrence: null,
  }

  for (let match = text.find(/(?:^|\s)#([\w-]+)/); match; match = text.find(/(?:^|\s)#([\w-]+)/)) {
    text.cut(match)
    const name = (match[1] ?? '').toLowerCase()
    const category = context.categories.find(
      (candidate) => !candidate.archived && candidate.name.toLowerCase().replace(/\s+/g, '-') === name,
    )
    if (category && result.categoryId === null) result.categoryId = category.id
    else if (!result.tags.includes(name)) result.tags.push(name)
  }

  const priority = text.find(/(?:^|\s)!(high|medium|med|low)(?![a-z])/i)
  if (priority) {
    text.cut(priority)
    const word = (priority[1] ?? '').toLowerCase()
    result.priority = word === 'high' ? 'high' : word === 'low' ? 'low' : 'medium'
  }

  const repeat = parseRecurrence(text)
  result.dueTime = parseTime(text)
  let date = parseDate(text, today)

  if (repeat) {
    result.recurrence = repeat.recurrence
    if (!date) {
      if (repeat.anchorWeekday !== null) date = onOrAfter(today, repeat.anchorWeekday)
      else if (repeat.recurrence.kind === 'weekdays') {
        date = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(today, offset)).find((day) => repeat.recurrence.weekdays.includes(getDay(day))) ?? today
      } else date = today
    }
  }
  result.dueDate = date ? toDateStr(date) : null

  let title = text.value.replace(/\s+/g, ' ').trim()
  while (DANGLING.test(title)) title = title.replace(DANGLING, '')
  title = title.replace(LEADING, '').trim()

  // Input that was nothing but instructions ("tomorrow 5pm") keeps its own text as the title.
  if (!title) return { title: raw, dueDate: null, dueTime: null, tags: [], categoryId: null, priority: null, recurrence: null }
  result.title = title
  return result
}
