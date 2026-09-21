import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/db/schema'
import { expandOccurrences } from '@/lib/recurrence'
import { makeTask } from '@/lib/tasks'
import { useTasksStore } from './tasks'

async function reset() {
  await Promise.all([db.tasks.clear(), db.categories.clear(), db.meta.clear()])
  useTasksStore.setState({ ready: false, error: null, tasks: [], categories: [] })
}

describe('tasks store + Dexie', () => {
  beforeEach(reset)

  it('seeds School / Personal / Work exactly once', async () => {
    await useTasksStore.getState().init()
    expect(useTasksStore.getState().categories.map((c) => c.name)).toEqual(['School', 'Personal', 'Work'])
    await useTasksStore.getState().init()
    expect(await db.categories.count()).toBe(3)
  })

  it('does not re-seed after every category is deleted', async () => {
    await useTasksStore.getState().init()
    await db.categories.clear()
    await useTasksStore.getState().init()
    expect(await db.categories.count()).toBe(0)
  })

  it('persists created tasks across a fresh load (simulated refresh)', async () => {
    const store = useTasksStore.getState()
    await store.init()
    const [category] = useTasksStore.getState().categories
    if (!category) throw new Error('no seed')
    await store.createTask({ ...makeTask({ title: 'Persist me', categoryId: category.id, dueDate: '2026-09-22' }) })
    useTasksStore.setState({ tasks: [], categories: [], ready: false })
    await useTasksStore.getState().init()
    expect(useTasksStore.getState().tasks.map((t) => t.title)).toEqual(['Persist me'])
  })

  it('completes and undoes a one-off task', async () => {
    const store = useTasksStore.getState()
    await store.init()
    const task = await store.createTask(makeTask({ title: 'A', categoryId: 'c', dueDate: '2026-09-22', status: 'in_progress' }))
    const [occ] = expandOccurrences([task], '2026-09-22', '2026-09-22')
    if (!occ) throw new Error('no occurrence')
    const undo = await store.setOccurrenceDone(occ, true)
    expect(useTasksStore.getState().tasks[0]).toMatchObject({ status: 'done' })
    await undo()
    expect(useTasksStore.getState().tasks[0]).toMatchObject({ status: 'in_progress', completedAt: null })
    expect((await db.tasks.get(task.id))?.status).toBe('in_progress')
  })

  it('completes one occurrence of a recurring task without finishing the series', async () => {
    const store = useTasksStore.getState()
    await store.init()
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
    await store.init()
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

  it('deletes tasks and can restore them', async () => {
    const store = useTasksStore.getState()
    await store.init()
    const task = await store.createTask(makeTask({ title: 'Gone', categoryId: 'c' }))
    const undo = await store.deleteTasks([task.id])
    expect(await db.tasks.count()).toBe(0)
    await undo()
    expect(await db.tasks.count()).toBe(1)
    expect(useTasksStore.getState().tasks).toHaveLength(1)
  })

  it('import replaces existing data', async () => {
    const store = useTasksStore.getState()
    await store.init()
    await store.createTask(makeTask({ title: 'Old', categoryId: 'c' }))
    await store.importAll(
      [makeTask({ title: 'New', categoryId: 'x' })],
      [{ id: 'x', name: 'X', colorKey: 'plum', archived: false, order: 0, createdAt: 0 }],
    )
    expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['New'])
    expect(useTasksStore.getState().categories.map((c) => c.name)).toEqual(['X'])
  })
})
