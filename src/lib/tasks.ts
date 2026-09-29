import type { Category, Task } from '@/types/model'

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
