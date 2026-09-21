import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type { Category, Task } from '@/types/model'

interface MetaRow {
  key: string
  value: string
}

export class DaybookDb extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  categories!: EntityTable<Category, 'id'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor(name = 'daybook') {
    super(name)
    this.version(1).stores({
      tasks: 'id, dueDate, categoryId, status, priority, createdAt, *tags',
      categories: 'id, archived, order',
      meta: 'key',
    })
  }
}

export const db = new DaybookDb()
