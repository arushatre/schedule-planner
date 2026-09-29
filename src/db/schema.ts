import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type { Category, ClassBlock, Task } from '@/types/model'

interface MetaRow {
  key: string
  value: string
}

/**
 * The pre-accounts local database. Signed-in data lives in the per-user cache (src/sync/cache.ts);
 * this schema is kept only so ImportLocalDialog can read and offer to import old tasks.
 */
export class DaybookDb extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  categories!: EntityTable<Category, 'id'>
  meta!: EntityTable<MetaRow, 'key'>
  classBlocks!: EntityTable<ClassBlock, 'id'>

  constructor(name = 'daybook') {
    super(name)
    this.version(1).stores({
      tasks: 'id, dueDate, categoryId, status, priority, createdAt, *tags',
      categories: 'id, archived, order',
      meta: 'key',
    })
    // v2 adds the weekly class schedule; existing tables are untouched.
    this.version(2).stores({
      tasks: 'id, dueDate, categoryId, status, priority, createdAt, *tags',
      categories: 'id, archived, order',
      meta: 'key',
      classBlocks: 'id',
    })
    // v3 renames the 'not_started' status to 'todo' to match the backend enum.
    this.version(3).upgrade((tx) =>
      tx
        .table<Task, string>('tasks')
        .toCollection()
        .modify((task) => {
          if ((task.status as string) === 'not_started') task.status = 'todo'
        }),
    )
  }
}
