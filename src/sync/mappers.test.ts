import { describe, expect, it } from 'vitest'

import { makeTask } from '@/lib/tasks'
import type { Category, ClassBlock } from '@/types/model'
import { categoryToRow, classBlockToRow, rowToCategory, rowToClassBlock, rowToTask, taskToPayload } from './mappers'
import type { TaskRowWithChildren } from './mappers'

const USER = '11111111-1111-1111-1111-111111111111'
const NOW = '2026-09-29T12:00:00.000Z'

describe('task mapping', () => {
  const task = makeTask({
    title: 'Essay draft',
    categoryId: crypto.randomUUID(),
    dueDate: '2026-10-02',
    dueTime: '17:00',
    tags: ['english', 'school'],
    priority: 'urgent',
    status: 'in_progress',
    subtasks: [
      { id: crypto.randomUUID(), title: 'Outline', done: true },
      { id: crypto.randomUUID(), title: 'Write', done: false },
    ],
    recurrence: { kind: 'weekdays', weekdays: [1, 3], until: '2026-12-01' },
    completedDates: ['2026-10-05'],
    exceptions: { '2026-10-05': '2026-10-06', '2026-10-07': '2026-10-08' },
    reminderTime: '16:30',
    createdAt: Date.parse('2026-09-01T08:00:00.000Z'),
  })

  it('builds the save_task payload with normalized children', () => {
    const payload = taskToPayload(task) as Record<string, unknown>
    expect(payload).toMatchObject({
      id: task.id,
      category_id: task.categoryId,
      priority: 'urgent',
      recurrence_kind: 'weekdays',
      recurrence_weekdays: [1, 3],
      tags: ['english', 'school'],
      created_at: '2026-09-01T08:00:00.000Z',
    })
    expect(payload.overrides).toEqual([
      { occurrence_date: '2026-10-05', completed: true, moved_to: '2026-10-06' },
      { occurrence_date: '2026-10-07', completed: false, moved_to: '2026-10-08' },
    ])
  })

  it('stores non-UUID category ids (the Uncategorized sentinel) as null', () => {
    const payload = taskToPayload({ ...task, categoryId: '__none__' }) as Record<string, unknown>
    expect(payload.category_id).toBeNull()
  })

  it('round-trips through the row shape Postgres returns', () => {
    const payload = taskToPayload(task) as Record<string, unknown> & {
      subtasks: { id: string; title: string; done: boolean }[]
      overrides: TaskRowWithChildren['task_occurrence_overrides']
    }
    const row: TaskRowWithChildren = {
      id: task.id,
      user_id: USER,
      category_id: task.categoryId,
      title: task.title,
      notes: task.notes,
      due_date: '2026-10-02',
      due_time: '17:00:00',
      priority: 'urgent',
      status: 'in_progress',
      recurrence_kind: 'weekdays',
      recurrence_weekdays: [1, 3],
      recurrence_until: '2026-12-01',
      reminder_time: '16:30:00',
      completed_at: null,
      created_at: '2026-09-01T08:00:00+00:00',
      updated_at: NOW,
      // Postgres returns children in arbitrary order; position restores it.
      subtasks: payload.subtasks.map((subtask, position) => ({ ...subtask, position })).reverse(),
      task_tags: [{ tags: { name: 'school' } }, { tags: { name: 'english' } }],
      task_occurrence_overrides: payload.overrides,
    }
    expect(rowToTask(row)).toEqual({ ...task, updatedAt: Date.parse(NOW) })
  })
})

describe('category and class block mapping', () => {
  it('round-trips a category', () => {
    const category: Category = { id: crypto.randomUUID(), name: 'School', colorKey: 'slate', archived: false, order: 2, createdAt: Date.parse(NOW) }
    const row = { ...categoryToRow(category), user_id: USER, updated_at: NOW } as Parameters<typeof rowToCategory>[0]
    expect(rowToCategory(row)).toEqual(category)
  })

  it('round-trips a class block, trimming Postgres seconds', () => {
    const block: ClassBlock = {
      id: crypto.randomUUID(),
      title: 'Math',
      location: 'Room 4',
      weekdays: [1, 3, 5],
      startTime: '09:00',
      endTime: '09:50',
      colorKey: 'moss',
      createdAt: Date.parse(NOW),
    }
    const row = {
      ...classBlockToRow(block),
      start_time: '09:00:00',
      end_time: '09:50:00',
      user_id: USER,
      updated_at: NOW,
    } as Parameters<typeof rowToClassBlock>[0]
    expect(rowToClassBlock(row)).toEqual(block)
  })
})
