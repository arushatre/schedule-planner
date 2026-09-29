import { PALETTE_KEYS } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'
import { PRIORITIES, RECURRENCE_KINDS, STATUSES } from '@/types/model'
import type { Category, ClassBlock, Priority, RecurrenceKind, Status, Subtask, Task } from '@/types/model'
import { isDateStr } from './dates'

export interface BackupData {
  tasks: Task[]
  categories: Category[]
  classBlocks: ClassBlock[]
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)
const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
const asDate = (value: unknown): string | null => (isDateStr(value) ? value : null)
const asTime = (value: unknown): string | null =>
  typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : null
const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.find((option) => option === value) ?? fallback
const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

function normalizeSubtask(raw: unknown): Subtask | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null
  return { id: raw.id, title: asString(raw.title), done: raw.done === true }
}

function normalizeTask(raw: unknown): Task | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string') return null
  if (!raw.title.trim()) return null
  const recurrence = isRecord(raw.recurrence) ? raw.recurrence : {}
  const exceptions: Record<string, string> = {}
  if (isRecord(raw.exceptions)) {
    for (const [from, to] of Object.entries(raw.exceptions)) {
      if (isDateStr(from) && isDateStr(to)) exceptions[from] = to
    }
  }
  const now = Date.now()
  return {
    id: raw.id,
    title: raw.title.trim(),
    notes: asString(raw.notes),
    dueDate: asDate(raw.dueDate),
    dueTime: asTime(raw.dueTime),
    categoryId: asString(raw.categoryId),
    tags: stringList(raw.tags),
    priority: oneOf<Priority>(PRIORITIES, raw.priority, 'medium'),
    // Backups made before the Supabase migration used 'not_started'.
    status: oneOf<Status>(STATUSES, raw.status === 'not_started' ? 'todo' : raw.status, 'todo'),
    subtasks: Array.isArray(raw.subtasks)
      ? raw.subtasks.map(normalizeSubtask).filter((sub): sub is Subtask => sub !== null)
      : [],
    recurrence: {
      kind: oneOf<RecurrenceKind>(RECURRENCE_KINDS, recurrence.kind, 'none'),
      weekdays: Array.isArray(recurrence.weekdays)
        ? recurrence.weekdays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
        : [],
      until: asDate(recurrence.until),
    },
    completedDates: stringList(raw.completedDates).filter(isDateStr),
    exceptions,
    reminderTime: asTime(raw.reminderTime),
    completedAt: typeof raw.completedAt === 'number' ? raw.completedAt : null,
    createdAt: asNumber(raw.createdAt, now),
    updatedAt: asNumber(raw.updatedAt, now),
  }
}

function normalizeCategory(raw: unknown, index: number): Category | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  const colorKey: PaletteKey = oneOf<PaletteKey>(PALETTE_KEYS, raw.colorKey, 'graphite')
  return {
    id: raw.id,
    name: raw.name,
    colorKey,
    archived: raw.archived === true,
    order: asNumber(raw.order, index),
    createdAt: asNumber(raw.createdAt, Date.now()),
  }
}

function normalizeBlock(raw: unknown): ClassBlock | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string') return null
  const startTime = asTime(raw.startTime)
  const endTime = asTime(raw.endTime)
  if (!startTime || !endTime) return null
  return {
    id: raw.id,
    title: raw.title,
    location: asString(raw.location),
    weekdays: Array.isArray(raw.weekdays)
      ? raw.weekdays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
      : [],
    startTime,
    endTime,
    colorKey: oneOf<PaletteKey>(PALETTE_KEYS, raw.colorKey, 'graphite'),
    createdAt: asNumber(raw.createdAt, Date.now()),
  }
}

/** Later rows win when an id appears twice, so a hand-edited file can't break the import. */
function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()]
}

export function serializeBackup(data: BackupData, now: Date = new Date()): string {
  return JSON.stringify(
    { app: 'daybook', version: 2, exportedAt: now.toISOString(), ...data },
    null,
    2,
  )
}

/** Parses and sanitises a backup file. Throws an Error with a readable message. */
export function parseBackup(text: string): BackupData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!isRecord(raw) || !Array.isArray(raw.tasks) || !Array.isArray(raw.categories)) {
    throw new Error('That file does not look like a Daybook backup.')
  }
  return {
    tasks: uniqueById(raw.tasks.map(normalizeTask).filter((task): task is Task => task !== null)),
    categories: uniqueById(
      raw.categories.map(normalizeCategory).filter((category): category is Category => category !== null),
    ),
    // Version 1 backups predate the class schedule.
    classBlocks: Array.isArray(raw.classBlocks)
      ? uniqueById(raw.classBlocks.map(normalizeBlock).filter((block): block is ClassBlock => block !== null))
      : [],
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The server keys every row by UUID. Backups and local data from before sync used short
 * nanoid ids, so replace any non-UUID id (keeping task -> category links intact).
 */
export function withUuidIds(data: BackupData): BackupData {
  const ids = new Map<string, string>()
  const remap = (id: string): string => {
    if (UUID.test(id)) return id
    const existing = ids.get(id)
    if (existing) return existing
    const next = crypto.randomUUID()
    ids.set(id, next)
    return next
  }
  const categories = data.categories.map((category) => ({ ...category, id: remap(category.id) }))
  const known = new Set(categories.map((category) => category.id))
  return {
    categories,
    classBlocks: data.classBlocks.map((block) => ({ ...block, id: remap(block.id) })),
    tasks: data.tasks.map((task) => {
      const categoryId = ids.get(task.categoryId) ?? task.categoryId
      return {
        ...task,
        id: remap(task.id),
        categoryId: known.has(categoryId) ? categoryId : '',
        subtasks: task.subtasks.map((subtask) => ({ ...subtask, id: remap(subtask.id) })),
      }
    }),
  }
}

export function downloadFile(filename: string, mime: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
