import { create } from 'zustand'

import { withUuidIds } from '@/lib/backup'
import type { BackupData } from '@/lib/backup'
import { isRecurring } from '@/lib/recurrence'
import { makeTask } from '@/lib/tasks'
import type { PaletteKey } from '@/lib/palette'
import type { Patch, SyncEngine } from '@/sync/engine'
import type { Category, ClassBlock, Occurrence, Status, Task } from '@/types/model'

export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'completedDates' | 'exceptions'>

/** Restores previous task state; returned from mutations so the UI can offer Undo. */
export type Undo = () => Promise<void>

const SEED_KEY = 'seeded'

const SEED_CATEGORIES: Pick<Category, 'name' | 'colorKey'>[] = [
  { name: 'School', colorKey: 'slate' },
  { name: 'Personal', colorKey: 'moss' },
  { name: 'Work', colorKey: 'clay' },
]

interface TasksState {
  ready: boolean
  error: string | null
  tasks: Task[]
  categories: Category[]
  classBlocks: ClassBlock[]

  /** Boots from the signed-in user's local cache; the engine then syncs in the background. */
  attach: (engine: SyncEngine) => Promise<void>
  detach: () => void
  /** Merges changes the engine made on its own (pull, realtime, other tabs, rollbacks). */
  applyPatch: (patch: Patch) => void
  /** Creates School / Personal / Work for a brand-new account (after the first successful pull). */
  seedIfEmpty: () => Promise<void>

  createTask: (draft: TaskDraft) => Promise<Task>
  saveTask: (task: Task) => Promise<void>
  deleteTasks: (ids: string[]) => Promise<Undo>
  setOccurrenceDone: (occ: Occurrence, done: boolean) => Promise<Undo>
  setOccurrenceStatus: (occ: Occurrence, status: Status) => Promise<Undo>
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>
  moveOccurrence: (occ: Occurrence, toDate: string) => Promise<Undo>
  createCategory: (name: string, colorKey: PaletteKey) => Promise<Category>
  saveCategory: (category: Category) => Promise<void>
  saveClassBlock: (block: ClassBlock) => Promise<void>
  deleteClassBlock: (id: string) => Promise<Undo>
  importAll: (data: BackupData) => Promise<void>
}

const EMPTY = { tasks: [], categories: [], classBlocks: [] }

let engine: SyncEngine | null = null

function sync(): SyncEngine {
  if (!engine) throw new Error('Not signed in: the sync engine is not attached.')
  return engine
}

const byOrder = (a: Category, b: Category) => a.order - b.order

function merge<T extends { id: string }>(current: T[], put: T[], remove: string[] = []): T[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  remove.forEach((id) => byId.delete(id))
  put.forEach((item) => byId.set(item.id, item))
  return [...byId.values()]
}

const lookup = <T extends { id: string }>(items: T[]) => {
  const byId = new Map(items.map((item) => [item.id, item]))
  return (id: string): T | null => byId.get(id) ?? null
}

export const useTasksStore = create<TasksState>()((set, get) => {
  /** Optimistic: state updates immediately, then the cache + outbox write happens. */
  const persist = async (tasks: Task[]) => {
    const before = lookup(get().tasks)
    const stamped = tasks.map((task) => ({ ...task, updatedAt: Date.now() }))
    set((state) => ({ tasks: merge(state.tasks, stamped) }))
    await sync().save('task', stamped, before)
  }

  const snapshotUndo = (before: Task[]): Undo => () => persist(before)

  const find = (id: string): Task => {
    const task = get().tasks.find((candidate) => candidate.id === id)
    if (!task) throw new Error(`Task ${id} not found`)
    return task
  }

  const saveCategories = async (categories: Category[]) => {
    const before = lookup(get().categories)
    set((state) => ({ categories: merge(state.categories, categories).sort(byOrder) }))
    await sync().save('category', categories, before)
  }

  const saveClassBlocks = async (blocks: ClassBlock[]) => {
    const before = lookup(get().classBlocks)
    set((state) => ({ classBlocks: merge(state.classBlocks, blocks) }))
    await sync().save('classBlock', blocks, before)
  }

  return {
    ready: false,
    error: null,
    ...EMPTY,

    attach: async (next) => {
      engine = next
      try {
        const { tasks, categories, classBlocks } = await next.load()
        // A newer engine may have replaced this one mid-load (StrictMode remount, account switch).
        if (engine !== next) return
        set({ tasks, categories: [...categories].sort(byOrder), classBlocks, ready: true, error: null })
      } catch (error) {
        if (engine !== next) return
        set({
          ready: true,
          error: error instanceof Error ? error.message : 'Could not open local storage.',
        })
      }
    },

    detach: () => {
      engine = null
      set({ ready: false, error: null, ...EMPTY })
    },

    applyPatch: (patch) =>
      set((state) => ({
        tasks: merge(state.tasks, patch.task.put, patch.task.remove),
        categories: merge(state.categories, patch.category.put, patch.category.remove).sort(byOrder),
        classBlocks: merge(state.classBlocks, patch.classBlock.put, patch.classBlock.remove),
      })),

    seedIfEmpty: async () => {
      const current = sync()
      if (!(await current.hasPulled()) || get().categories.length > 0) return
      if (await current.cache.getMeta(SEED_KEY)) return
      await current.cache.setMeta(SEED_KEY, '1')
      const now = Date.now()
      await saveCategories(
        SEED_CATEGORIES.map((seed, order) => ({
          id: crypto.randomUUID(),
          archived: false,
          order,
          createdAt: now,
          ...seed,
        })),
      )
    },

    createTask: async (draft) => {
      const task = makeTask(draft)
      await persist([task])
      return task
    },

    saveTask: async (task) => {
      await persist([task])
    },

    deleteTasks: async (ids) => {
      const removed = get().tasks.filter((task) => ids.includes(task.id))
      set((state) => ({ tasks: state.tasks.filter((task) => !ids.includes(task.id)) }))
      await sync().remove('task', ids, lookup(removed))
      return () => persist(removed)
    },

    setOccurrenceDone: async (occ, done) => {
      const before = find(occ.task.id)
      let after: Task
      if (isRecurring(before) && occ.originalDate) {
        const dates = new Set(before.completedDates)
        if (done) dates.add(occ.originalDate)
        else dates.delete(occ.originalDate)
        after = { ...before, completedDates: [...dates] }
      } else {
        after = {
          ...before,
          status: done ? 'done' : 'todo',
          completedAt: done ? Date.now() : null,
        }
      }
      await persist([after])
      return snapshotUndo([before])
    },

    setOccurrenceStatus: async (occ, status) => {
      const before = find(occ.task.id)
      let after: Task
      if (isRecurring(before) && occ.originalDate) {
        // Done is tracked per occurrence; "in progress" applies to the whole series.
        const dates = new Set(before.completedDates)
        if (status === 'done') dates.add(occ.originalDate)
        else dates.delete(occ.originalDate)
        after = { ...before, completedDates: [...dates], status: status === 'done' ? before.status : status }
      } else {
        after = {
          ...before,
          status,
          completedAt: status !== 'done' ? null : before.status === 'done' ? before.completedAt : Date.now(),
        }
      }
      await persist([after])
      return snapshotUndo([before])
    },

    toggleSubtask: async (taskId, subtaskId) => {
      const before = find(taskId)
      await persist([
        {
          ...before,
          subtasks: before.subtasks.map((sub) =>
            sub.id === subtaskId ? { ...sub, done: !sub.done } : sub,
          ),
        },
      ])
    },

    moveOccurrence: async (occ, toDate) => {
      const before = find(occ.task.id)
      let after: Task
      if (isRecurring(before) && occ.originalDate) {
        const exceptions = { ...before.exceptions }
        if (toDate === occ.originalDate) delete exceptions[occ.originalDate]
        else exceptions[occ.originalDate] = toDate
        after = { ...before, exceptions }
      } else {
        after = { ...before, dueDate: toDate }
      }
      await persist([after])
      return snapshotUndo([before])
    },

    createCategory: async (name, colorKey) => {
      const { categories } = get()
      const category: Category = {
        id: crypto.randomUUID(),
        name: name.trim(),
        colorKey,
        archived: false,
        order: categories.reduce((max, current) => Math.max(max, current.order), -1) + 1,
        createdAt: Date.now(),
      }
      await saveCategories([category])
      return category
    },

    saveCategory: async (category) => {
      await saveCategories([category])
    },

    saveClassBlock: async (block) => {
      await saveClassBlocks([block])
    },

    deleteClassBlock: async (id) => {
      const removed = get().classBlocks.filter((block) => block.id === id)
      set((state) => ({ classBlocks: state.classBlocks.filter((block) => block.id !== id) }))
      await sync().remove('classBlock', [id], lookup(removed))
      return () => saveClassBlocks(removed)
    },

    /** Replaces everything. Categories go first so imported tasks never reference a missing one. */
    importAll: async (raw) => {
      const data = withUuidIds(raw)
      const { tasks, categories, classBlocks } = get()
      const keep = <T extends { id: string }>(items: { id: string }[]) => {
        const ids = new Set(items.map((item) => item.id))
        return (item: T) => !ids.has(item.id)
      }
      const staleTasks = tasks.filter(keep<Task>(data.tasks))
      const staleBlocks = classBlocks.filter(keep<ClassBlock>(data.classBlocks))
      const staleCategories = categories.filter(keep<Category>(data.categories))

      await saveCategories(data.categories)
      await saveClassBlocks(data.classBlocks)
      await persist(data.tasks)
      set((state) => ({
        tasks: state.tasks.filter(keep<Task>(staleTasks)),
        classBlocks: state.classBlocks.filter(keep<ClassBlock>(staleBlocks)),
        categories: state.categories.filter(keep<Category>(staleCategories)),
      }))
      await sync().remove('task', staleTasks.map((task) => task.id), lookup(staleTasks))
      await sync().remove('classBlock', staleBlocks.map((block) => block.id), lookup(staleBlocks))
      await sync().remove('category', staleCategories.map((category) => category.id), lookup(staleCategories))
    },
  }
})
