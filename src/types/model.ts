import type { PaletteKey } from '@/lib/palette'

export const PRIORITIES = ['low', 'medium', 'high'] as const
export type Priority = (typeof PRIORITIES)[number]

export const STATUSES = ['not_started', 'in_progress', 'done'] as const
export type Status = (typeof STATUSES)[number]

export const RECURRENCE_KINDS = ['none', 'daily', 'weekly', 'weekdays', 'monthly'] as const
export type RecurrenceKind = (typeof RECURRENCE_KINDS)[number]

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const STATUS_LABEL: Record<Status, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
}

export const RECURRENCE_LABEL: Record<RecurrenceKind, string> = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  weekdays: 'Custom weekdays',
  monthly: 'Monthly',
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Recurrence {
  kind: RecurrenceKind
  /** 0 (Sunday) to 6 (Saturday); used when kind is 'weekdays'. */
  weekdays: number[]
  /** Last date (YYYY-MM-DD) an occurrence may fall on. */
  until: string | null
}

/** Dates are local `YYYY-MM-DD`, times are local `HH:mm`, timestamps are epoch ms. */
export interface Task {
  id: string
  title: string
  notes: string
  dueDate: string | null
  dueTime: string | null
  categoryId: string
  tags: string[]
  priority: Priority
  status: Status
  subtasks: Subtask[]
  recurrence: Recurrence
  /** Original occurrence dates completed, for recurring tasks. */
  completedDates: string[]
  /** Single-occurrence drags: original date -> new date. */
  exceptions: Record<string, string>
  reminderTime: string | null
  completedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Category {
  id: string
  name: string
  colorKey: PaletteKey
  archived: boolean
  order: number
  createdAt: number
}

/** A recurring fixed block on the weekly schedule, e.g. "Math, Mon/Wed/Fri 9:00-9:50". */
export interface ClassBlock {
  id: string
  title: string
  location: string
  /** 0 (Sunday) to 6 (Saturday). */
  weekdays: number[]
  startTime: string
  endTime: string
  colorKey: PaletteKey
  createdAt: number
}

/** One appearance of a task on a date (recurring tasks yield many). */
export interface Occurrence {
  key: string
  task: Task
  /** Where it currently appears; null for tasks without a due date. */
  date: string | null
  /** The date it was generated for, before any drag. */
  originalDate: string | null
  done: boolean
}
