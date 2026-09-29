import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { expandOccurrences } from '@/lib/recurrence'
import { makeTask } from '@/lib/tasks'
import { CacheDb } from '@/sync/cache'
import { SyncEngine } from '@/sync/engine'
import { FakeRemote } from '@/test/fakeRemote'
import { useTasksStore } from './tasks'

let userId = ''
let cache: CacheDb
let engine: SyncEngine
let remote: FakeRemote

/** Attaches the store to a fresh engine over the same per-user cache (a page load). */
async function boot({ online = false } = {}) {
  engine?.stop()
  engine = new SyncEngine({
    userId,
    cache,
    remote,
    isOnline: () => online,
    onPatch: (patch) => useTasksStore.getState().applyPatch(patch),
    onStatus: () => undefined,
    onRejected: () => undefined,
  })
  await useTasksStore.getState().attach(engine)
}

beforeEach(() => {
  userId = crypto.randomUUID()
  cache = new CacheDb(userId)
  remote = new FakeRemote()
  useTasksStore.getState().detach()
})

afterEach(async () => {
  engine.stop()
  cache.close()
  await cache.delete()
})

describe('tasks store + sync cache', () => {
  it('seeds School / Personal / Work once, only after the first successful pull', async () => {
    await boot()
    await useTasksStore.getState().seedIfEmpty()
    expect(useTasksStore.getState().categories).toHaveLength(0)

    await boot({ online: true })
    await engine.pull()
    await useTasksStore.getState().seedIfEmpty()
    await useTasksStore.getState().seedIfEmpty()
    expect(useTasksStore.getState().categories.map((c) => c.name)).toEqual(['School', 'Personal', 'Work'])
    expect(await cache.categories.count()).toBe(3)
  })

  it('does not seed an account that already has categories on the server', async () => {
    remote.seed({ categories: [{ id: crypto.randomUUID(), name: 'Mine', colorKey: 'teal', archived: false, order: 0, createdAt: 0 }] })
    await boot({ online: true })
    await engine.pull()
    await useTasksStore.getState().seedIfEmpty()
    expect(useTasksStore.getState().categories.map((c) => c.name)).toEqual(['Mine'])
  })

  it('updates state optimistically and persists across a fresh load (simulated refresh)', async () => {
    await boot()
    const pending = useTasksStore.getState().createTask(makeTask({ title: 'Persist me', categoryId: '', dueDate: '2026-09-22' }))
    expect(useTasksStore.getState().tasks.map((t) => t.title)).toEqual(['Persist me'])
    await pending
    useTasksStore.getState().detach()
    await boot()
    expect(useTasksStore.getState().tasks.map((t) => t.title)).toEqual(['Persist me'])
    expect(await cache.outbox.count()).toBe(1)
  })

  it('completes and undoes a one-off task', async () => {
    const store = useTasksStore.getState()
    await boot()
    const task = await store.createTask(makeTask({ title: 'A', categoryId: 'c', dueDate: '2026-09-22', status: 'in_progress' }))
    const [occ] = expandOccurrences([task], '2026-09-22', '2026-09-22')
    if (!occ) throw new Error('no occurrence')
    const undo = await store.setOccurrenceDone(occ, true)
    expect(useTasksStore.getState().tasks[0]).toMatchObject({ status: 'done' })
    await undo()
    expect(useTasksStore.getState().tasks[0]).toMatchObject({ status: 'in_progress', completedAt: null })
    expect((await cache.tasks.get(task.id))?.status).toBe('in_progress')
  })

  it('completes one occurrence of a recurring task without finishing the series', async () => {
    const store = useTasksStore.getState()
    await boot()
    const task = await store.createTask(
      makeTask({
        title: 'Habit',
        categoryId: 'c',
        dueDate: '2026-09-21',
        recurrence: { kind: 'daily', weekdays: [], until: null },
      }),
    )
    const [first] = expandOccurrences([task], '2026-09-21', '2026-09-23')
    if (!first) throw new Error('no occurrence')
    await store.setOccurrenceDone(first, true)
    const occs = expandOccurrences(useTasksStore.getState().tasks, '2026-09-21', '2026-09-23')
    expect(occs.map((o) => o.done)).toEqual([true, false, false])
  })

  it('reschedules a one-off by date and a recurring occurrence by exception', async () => {
    const store = useTasksStore.getState()
    await boot()
    const once = await store.createTask(makeTask({ title: 'Once', categoryId: 'c', dueDate: '2026-09-22' }))
    const habit = await store.createTask(
      makeTask({ title: 'Habit', categoryId: 'c', dueDate: '2026-09-22', recurrence: { kind: 'daily', weekdays: [], until: null } }),
    )
    const [onceOcc] = expandOccurrences([once], '2026-09-22', '2026-09-22')
    const [habitOcc] = expandOccurrences([habit], '2026-09-22', '2026-09-22')
    if (!onceOcc || !habitOcc) throw new Error('no occurrence')

    await store.moveOccurrence(onceOcc, '2026-09-30')
    const undo = await store.moveOccurrence(habitOcc, '2026-09-30')
    const tasks = useTasksStore.getState().tasks
    expect(tasks.find((t) => t.id === once.id)?.dueDate).toBe('2026-09-30')
    expect(tasks.find((t) => t.id === habit.id)).toMatchObject({ dueDate: '2026-09-22', exceptions: { '2026-09-22': '2026-09-30' } })
    await undo()
    expect(useTasksStore.getState().tasks.find((t) => t.id === habit.id)?.exceptions).toEqual({})
  })

  it('moves a one-off task across board columns and stamps completion', async () => {
    const store = useTasksStore.getState()
    await boot()
    const task = await store.createTask(makeTask({ title: 'Card', categoryId: 'c', dueDate: '2026-09-22' }))
    const [occ] = expandOccurrences([task], '2026-09-22', '2026-09-22')
    if (!occ) throw new Error('no occurrence')

    await store.setOccurrenceStatus(occ, 'in_progress')
    expect(useTasksStore.getState().tasks[0]).toMatchObject({ status: 'in_progress', completedAt: null })

    const undo = await store.setOccurrenceStatus(occ, 'done')
    const done = useTasksStore.getState().tasks[0]
    expect(done?.status).toBe('done')
    expect(done?.completedAt).toEqual(expect.any(Number))

    await undo()
    expect(useTasksStore.getState().tasks[0]).toMatchObject({ status: 'in_progress', completedAt: null })
    await store.setOccurrenceStatus(occ, 'todo')
    expect((await cache.tasks.get(task.id))?.status).toBe('todo')
  })

  it('board "done" on a recurring task completes only that occurrence', async () => {
    const store = useTasksStore.getState()
    await boot()
    const habit = await store.createTask(
      makeTask({ title: 'Habit', categoryId: 'c', dueDate: '2026-09-21', recurrence: { kind: 'daily', weekdays: [], until: null } }),
    )
    const [first] = expandOccurrences([habit], '2026-09-21', '2026-09-23')
    if (!first) throw new Error('no occurrence')
    await store.setOccurrenceStatus(first, 'done')
    const stored = useTasksStore.getState().tasks[0]
    expect(stored?.completedDates).toEqual(['2026-09-21'])
    expect(stored?.status).toBe('todo')
    await store.setOccurrenceStatus({ ...first, done: true }, 'todo')
    expect(useTasksStore.getState().tasks[0]?.completedDates).toEqual([])
  })

  it('deletes tasks and can restore them', async () => {
    const store = useTasksStore.getState()
    await boot()
    const task = await store.createTask(makeTask({ title: 'Gone', categoryId: 'c' }))
    const undo = await store.deleteTasks([task.id])
    expect(await cache.tasks.count()).toBe(0)
    await undo()
    expect(await cache.tasks.count()).toBe(1)
    expect(useTasksStore.getState().tasks).toHaveLength(1)
  })

  it('import replaces existing data', async () => {
    const store = useTasksStore.getState()
    await boot()
    await store.createTask(makeTask({ title: 'Old', categoryId: 'c' }))
    await store.importAll({
      tasks: [makeTask({ title: 'New', categoryId: 'x' })],
      categories: [{ id: 'x', name: 'X', colorKey: 'plum', archived: false, order: 0, createdAt: 0 }],
      classBlocks: [
        { id: 'b', title: 'Math', location: '', weekdays: [1], startTime: '09:00', endTime: '10:00', colorKey: 'slate', createdAt: 0 },
      ],
    })
    expect((await cache.tasks.toArray()).map((t) => t.title)).toEqual(['New'])
    expect(useTasksStore.getState().categories.map((c) => c.name)).toEqual(['X'])
    expect((await cache.classBlocks.toArray()).map((b) => b.title)).toEqual(['Math'])
  })

  it('saves, updates and deletes class blocks with undo', async () => {
    const store = useTasksStore.getState()
    await boot()
    const block = { id: 'b1', title: 'Math', location: '', weekdays: [1, 3], startTime: '09:00', endTime: '09:50', colorKey: 'plum' as const, createdAt: 1 }
    await store.saveClassBlock(block)
    await store.saveClassBlock({ ...block, title: 'Math II' })
    expect(useTasksStore.getState().classBlocks.map((b) => b.title)).toEqual(['Math II'])
    expect(await cache.classBlocks.count()).toBe(1)
    const undo = await store.deleteClassBlock('b1')
    expect(await cache.classBlocks.count()).toBe(0)
    await undo()
    expect(useTasksStore.getState().classBlocks).toHaveLength(1)
    expect(await cache.classBlocks.count()).toBe(1)
  })
})
