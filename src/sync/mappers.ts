import type { Json, Tables, TablesInsert } from '@/types/database'
import type { Category, ClassBlock, Subtask, Task } from '@/types/model'

/** A task row as fetched with its children embedded (see TASK_SELECT). */
export type TaskRowWithChildren = Tables<'tasks'> & {
  subtasks: Pick<Tables<'subtasks'>, 'id' | 'title' | 'done' | 'position'>[]
  task_tags: { tags: Pick<Tables<'tags'>, 'name'> | null }[]
  task_occurrence_overrides: Pick<Tables<'task_occurrence_overrides'>, 'occurrence_date' | 'completed' | 'moved_to'>[]
}

export const TASK_SELECT =
  '*, subtasks(id, title, done, position), task_tags(tags(name)), task_occurrence_overrides(occurrence_date, completed, moved_to)'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (value: string): boolean => UUID.test(value)

const toIso = (ms: number): string => new Date(ms).toISOString()
const toMs = (iso: string): number => new Date(iso).getTime()

/** Postgres returns `time` as HH:MM:SS; the app uses HH:mm. */
const toHm = (time: string | null): string | null => (time ? time.slice(0, 5) : null)

export function taskToPayload(task: Task): Json {
  const overrides = new Map<string, { occurrence_date: string; completed: boolean; moved_to: string | null }>()
  for (const date of task.completedDates) {
    overrides.set(date, { occurrence_date: date, completed: true, moved_to: null })
  }
  for (const [from, to] of Object.entries(task.exceptions)) {
    const existing = overrides.get(from)
    overrides.set(from, { occurrence_date: from, completed: existing?.completed ?? false, moved_to: to })
  }
  return {
    id: task.id,
    // Anything that isn't a real category id (e.g. the "Uncategorized" sentinel) is stored as null.
    category_id: isUuid(task.categoryId) ? task.categoryId : null,
    title: task.title,
    notes: task.notes,
    due_date: task.dueDate,
    due_time: task.dueTime,
    priority: task.priority,
    status: task.status,
    recurrence_kind: task.recurrence.kind,
    recurrence_weekdays: task.recurrence.weekdays,
    recurrence_until: task.recurrence.until,
    reminder_time: task.reminderTime,
    completed_at: task.completedAt === null ? null : toIso(task.completedAt),
    created_at: toIso(task.createdAt),
    subtasks: task.subtasks.map((subtask) => ({ id: subtask.id, title: subtask.title, done: subtask.done })),
    tags: task.tags,
    overrides: [...overrides.values()],
  }
}

export function rowToTask(row: TaskRowWithChildren): Task {
  const subtasks: Subtask[] = [...row.subtasks]
    .sort((a, b) => a.position - b.position)
    .map((subtask) => ({ id: subtask.id, title: subtask.title, done: subtask.done }))
  const completedDates: string[] = []
  const exceptions: Record<string, string> = {}
  for (const override of row.task_occurrence_overrides) {
    if (override.completed) completedDates.push(override.occurrence_date)
    if (override.moved_to) exceptions[override.occurrence_date] = override.moved_to
  }
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    dueTime: toHm(row.due_time),
    categoryId: row.category_id ?? '',
    tags: row.task_tags.flatMap((link) => (link.tags ? [link.tags.name] : [])).sort(),
    priority: row.priority,
    status: row.status,
    subtasks,
    recurrence: { kind: row.recurrence_kind, weekdays: row.recurrence_weekdays, until: row.recurrence_until },
    completedDates: completedDates.sort(),
    exceptions,
    reminderTime: toHm(row.reminder_time),
    completedAt: row.completed_at === null ? null : toMs(row.completed_at),
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
  }
}

export function categoryToRow(category: Category): TablesInsert<'categories'> {
  return {
    id: category.id,
    name: category.name,
    color_key: category.colorKey,
    archived: category.archived,
    sort_order: category.order,
    created_at: toIso(category.createdAt),
  }
}

export function rowToCategory(row: Tables<'categories'>): Category {
  return {
    id: row.id,
    name: row.name,
    colorKey: row.color_key,
    archived: row.archived,
    order: row.sort_order,
    createdAt: toMs(row.created_at),
  }
}

export function classBlockToRow(block: ClassBlock): TablesInsert<'class_blocks'> {
  return {
    id: block.id,
    title: block.title,
    location: block.location,
    weekdays: block.weekdays,
    start_time: block.startTime,
    end_time: block.endTime,
    color_key: block.colorKey,
    created_at: toIso(block.createdAt),
  }
}

export function rowToClassBlock(row: Tables<'class_blocks'>): ClassBlock {
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    weekdays: row.weekdays,
    startTime: toHm(row.start_time) ?? row.start_time,
    endTime: toHm(row.end_time) ?? row.end_time,
    colorKey: row.color_key,
    createdAt: toMs(row.created_at),
  }
}
