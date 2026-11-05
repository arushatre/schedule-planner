import type { Category, Occurrence, Task } from '@/types/model'

export function makeTask(overrides: Partial<Task> & Pick<Task, 'title' | 'categoryId'>): Task {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    notes: '',
    dueDate: null,
    dueTime: null,
    tags: [],
    priority: 'medium',
    status: 'todo',
    subtasks: [],
    recurrence: { kind: 'none', weekdays: [], until: null },
    completedDates: [],
    exceptions: {},
    reminderTime: null,
    alerts: [],
    sortOrder: 0,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function subtaskProgress(task: Task): { done: number; total: number } {
  return { done: task.subtasks.filter((subtask) => subtask.done).length, total: task.subtasks.length }
}

export const UNCATEGORIZED: Category = {
  id: '__none__',
  name: 'Uncategorized',
  colorKey: 'graphite',
  archived: false,
  order: Number.MAX_SAFE_INTEGER,
  createdAt: 0,
}

export function categoryFor(id: string, categories: Category[]): Category {
  return categories.find((category) => category.id === id) ?? UNCATEGORIZED
}

/** The category new tasks start in: the chosen default if it's still active, else the first active one. */
export function defaultCategoryId(categories: Category[], preferred: string | null): string {
  const active = categories.filter((category) => !category.archived)
  return active.find((category) => category.id === preferred)?.id ?? active[0]?.id ?? ''
}

/** Where a brand-new task goes in "My order": after everything else. */
export function nextSortOrder(tasks: Task[]): number {
  return tasks.reduce((max, task) => Math.max(max, task.sortOrder), 0) + 1
}

export interface OrderUpdate {
  id: string
  sortOrder: number
}

/**
 * New positions after dragging `list[from]` to index `to` in a list shown in "My order". Usually one
 * update: the moved task takes the midpoint of its new neighbors (other occurrences of the same
 * recurring task don't count). If the neighbors tie, the list's tasks are renumbered in their new order.
 */
export function orderAfterMove(list: Occurrence[], from: number, to: number): OrderUpdate[] {
  const item = list[from]
  if (!item || from === to || to < 0 || to >= list.length) return []
  const moved = list.filter((_, index) => index !== from)
  moved.splice(to, 0, item)
  const neighbor = (step: number) => {
    for (let i = to + step; i >= 0 && i < moved.length; i += step) {
      const other = moved[i]
      if (other && other.task.id !== item.task.id) return other.task.sortOrder
    }
    return undefined
  }
  const prev = neighbor(-1)
  const next = neighbor(1)
  const id = item.task.id
  if (prev === undefined && next === undefined) return []
  if (next === undefined) return [{ id, sortOrder: (prev as number) + 1 }]
  if (prev === undefined) return [{ id, sortOrder: next - 1 }]
  if (prev < next) return [{ id, sortOrder: (prev + next) / 2 }]
  // shortcut: renumbering from the list's lowest value can overlap tasks outside this list; only hit on ties, which midpoints make rare.
  const start = Math.min(...moved.map((occ) => occ.task.sortOrder))
  const ids = [...new Set(moved.map((occ) => occ.task.id))]
  return ids.map((taskId, index) => ({ id: taskId, sortOrder: start + index }))
}

/**
 * Where a dragged row lands: its offset clamped to the list, and its new index. Moving down, it
 * passes a row once its bottom edge crosses that row's midpoint; moving up, once its top edge does.
 * `heights` are the rows' heights in display order.
 */
export function dropIndex(heights: number[], from: number, dy: number): { offset: number; to: number } {
  const tops: number[] = []
  let total = 0
  for (const height of heights) {
    tops.push(total)
    total += height
  }
  const top = tops[from] ?? 0
  const own = heights[from] ?? 0
  const offset = Math.min(Math.max(dy, 0 - top), total - top - own)
  const dragTop = top + offset
  let to = 0
  heights.forEach((height, index) => {
    const middle = (tops[index] ?? 0) + height / 2
    if (index < from && dragTop >= middle) to += 1
    if (index > from && dragTop + own > middle) to += 1
  })
  return { offset, to }
}
