import { nanoid } from 'nanoid'

import type { Category, Task } from '@/types/model'
import { db } from './schema'

const SEED_KEY = 'seeded'

const SEED_CATEGORIES: Pick<Category, 'name' | 'colorKey'>[] = [
  { name: 'School', colorKey: 'slate' },
  { name: 'Personal', colorKey: 'moss' },
  { name: 'Work', colorKey: 'clay' },
]

/** Creates School / Personal / Work once. Deleting them later never re-seeds. */
export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', db.categories, db.meta, async () => {
    if (await db.meta.get(SEED_KEY)) return
    const now = Date.now()
    await db.categories.bulkAdd(
      SEED_CATEGORIES.map((seed, order) => ({
        id: nanoid(10),
        archived: false,
        order,
        createdAt: now,
        ...seed,
      })),
    )
    await db.meta.put({ key: SEED_KEY, value: '1' })
  })
}

export async function loadAll(): Promise<{ tasks: Task[]; categories: Category[] }> {
  const [tasks, categories] = await Promise.all([
    db.tasks.toArray(),
    db.categories.orderBy('order').toArray(),
  ])
  return { tasks, categories }
}

export async function putTasks(tasks: Task[]): Promise<void> {
  await db.tasks.bulkPut(tasks)
}

export async function deleteTasks(ids: string[]): Promise<void> {
  await db.tasks.bulkDelete(ids)
}

export async function putCategory(category: Category): Promise<void> {
  await db.categories.put(category)
}

/** Replaces everything (used by import). Marks seeded so defaults don't return. */
export async function replaceAll(tasks: Task[], categories: Category[]): Promise<void> {
  await db.transaction('rw', db.tasks, db.categories, db.meta, async () => {
    await db.tasks.clear()
    await db.categories.clear()
    await db.tasks.bulkAdd(tasks)
    await db.categories.bulkAdd(categories)
    await db.meta.put({ key: SEED_KEY, value: '1' })
  })
}
