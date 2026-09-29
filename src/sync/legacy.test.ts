import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DaybookDb } from '@/db/schema'
import { isUuid } from '@/sync/mappers'
import { useTasksStore } from '@/store/tasks'
import { FakeRemote } from '@/test/fakeRemote'
import type { Category, Task } from '@/types/model'
import { makeTask } from '@/lib/tasks'
import { CacheDb } from './cache'
import { SyncEngine } from './engine'
import { LEGACY_ANSWERED_KEY, planLegacyImport, readLegacyData, useLegacyImport } from './legacy'

const legacyCategories: Category[] = [
  { id: 'c-school', name: 'school', colorKey: 'slate', archived: false, order: 0, createdAt: 1 },
  { id: 'c-band', name: 'Band', colorKey: 'plum', archived: false, order: 1, createdAt: 1 },
]
const legacyTasks: Task[] = [
  makeTask({ id: 'abc123', title: 'Essay', categoryId: 'c-school', subtasks: [{ id: 's1', title: 'Outline', done: false }] }),
  makeTask({ id: 'def456', title: 'Practice scales', categoryId: 'c-band' }),
]

async function writeLegacy(tasks: Task[] = legacyTasks) {
  const db = new DaybookDb('daybook')
  await db.categories.bulkAdd(legacyCategories)
  // Rows written before the enum rename still say 'not_started'.
  await db.tasks.bulkAdd(tasks.map((task) => ({ ...task, status: 'not_started' as Task['status'] })))
  db.close()
}

afterEach(async () => {
  await Dexie.delete('daybook')
})

describe('planLegacyImport', () => {
  it('assigns UUIDs and reuses existing categories with the same name', () => {
    const existing: Category[] = [
      { id: crypto.randomUUID(), name: 'School', colorKey: 'slate', archived: false, order: 0, createdAt: 0 },
      { id: crypto.randomUUID(), name: 'Work', colorKey: 'clay', archived: false, order: 4, createdAt: 0 },
    ]
    const plan = planLegacyImport({ tasks: legacyTasks, categories: legacyCategories, classBlocks: [] }, existing)

    expect(plan.categories.map((category) => [category.name, category.order])).toEqual([['Band', 6]])
    const [essay, scales] = plan.tasks
    expect(essay?.categoryId).toBe(existing[0]?.id)
    expect(scales?.categoryId).toBe(plan.categories[0]?.id)
    expect(plan.tasks.every((task) => isUuid(task.id) && task.subtasks.every((sub) => isUuid(sub.id)))).toBe(true)
  })
})

describe('local data import offer', () => {
  let cache: CacheDb
  let engine: SyncEngine
  const userId = crypto.randomUUID()

  beforeEach(async () => {
    cache = new CacheDb(userId)
    engine = new SyncEngine({
      userId,
      cache,
      remote: new FakeRemote(),
      isOnline: () => false,
      onPatch: (patch) => useTasksStore.getState().applyPatch(patch),
      onStatus: () => undefined,
      onRejected: () => undefined,
    })
    useTasksStore.getState().detach()
    useLegacyImport.setState({ offer: null })
    await useTasksStore.getState().attach(engine)
  })

  afterEach(async () => {
    engine.stop()
    cache.close()
    await cache.delete()
  })

  it('reads nothing when the browser never had local data', async () => {
    expect(await readLegacyData()).toBeNull()
  })

  it('offers local data once, merges it, and never offers it again', async () => {
    await writeLegacy()
    await useTasksStore.getState().offerLocalImport()
    const offer = useLegacyImport.getState().offer
    expect(offer?.tasks.map((task) => task.status)).toEqual(['todo', 'todo'])

    await useTasksStore.getState().answerLocalImport(userId, offer ?? null)
    const { tasks, categories } = useTasksStore.getState()
    expect(tasks.map((task) => task.title).sort()).toEqual(['Essay', 'Practice scales'])
    expect(categories.map((category) => category.name)).toEqual(['school', 'Band'])
    expect(await cache.outbox.count()).toBe(4)
    expect(useLegacyImport.getState().offer).toBeNull()

    // Marked as imported: neither this nor any other account is offered it again.
    expect(await readLegacyData()).toBeNull()
  })

  it('remembers "Not now" for this account without touching the local copy', async () => {
    await writeLegacy()
    await useTasksStore.getState().offerLocalImport()
    await useTasksStore.getState().answerLocalImport(userId, null)
    expect(await cache.getMeta(LEGACY_ANSWERED_KEY)).toBe('declined')

    await useTasksStore.getState().offerLocalImport()
    expect(useLegacyImport.getState().offer).toBeNull()
    expect(await readLegacyData()).not.toBeNull()
  })

  it('does not offer an import to an account that already has tasks', async () => {
    await writeLegacy()
    await useTasksStore.getState().createTask(makeTask({ title: 'Already here', categoryId: '' }))
    await useTasksStore.getState().offerLocalImport()
    expect(useLegacyImport.getState().offer).toBeNull()
  })
})
