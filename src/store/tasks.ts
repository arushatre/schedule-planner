import { create } from 'zustand'

import { withUuidIds } from '@/lib/backup'
import type { BackupData } from '@/lib/backup'
import { isRecurring } from '@/lib/recurrence'
import { makeTask, nextSortOrder } from '@/lib/tasks'
import type { OrderUpdate } from '@/lib/tasks'
import type { PaletteKey } from '@/lib/palette'
import type { ActivityEvent } from '@/lib/activity'
import type { ActivityTracker } from '@/sync/activity'
import type { Patch, SyncEngine } from '@/sync/engine'
import { LEGACY_ANSWERED_KEY, markLegacyImported, readLegacyData, useLegacyImport } from '@/sync/legacy'
import { planLegacyImport } from '@/sync/records'
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
  /** When the user used the app (streak history). */
  activity: ActivityEvent[]

  /** Boots from the signed-in user's local cache; the engine then syncs in the background. */
  attach: (engine: SyncEngine, tracker?: ActivityTracker) => Promise<void>
  detach: () => void
  /** Merges changes the engine made on its own (pull, realtime, other tabs, rollbacks). */
  applyPatch: (patch: Patch) => void
  /** Creates School / Personal / Work for a brand-new account (after the first successful pull). */
  seedIfEmpty: () => Promise<void>
  /** Offers pre-accounts local data to an account that has no tasks yet (once per account). */
  offerLocalImport: () => Promise<void>
  /** Answers the offer: merges the data into the account, or declines with null. */
  answerLocalImport: (userId: string, data: BackupData | null) => Promise<void>
  /** Pushes queued writes and pulls the latest server state now. */
  syncNow: () => Promise<void>

  createTask: (draft: TaskDraft) => Promise<Task>
  saveTask: (task: Task) => Promise<void>
  /** Applies drag-to-reorder positions ("My order"). */
  reorderTasks: (updates: OrderUpdate[]) => Promise<void>
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
let tracker: ActivityTracker | null = null
let stopActivity: (() => void) | null = null

/** Any change the user makes counts as using the app; signing in alone doesn't. */
const touch = (kind: string) => tracker?.record(kind)

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
    touch('task')
    await sync().save('task', stamped, before)
  }

  const snapshotUndo = (before: Task[]): Undo => () => persist(before)

  const find = (id: string): Task => {
    const task = get().tasks.find((candidate) => candidate.id === id)
    if (!task) throw new Error(`Task ${id} not found`)
    return task
  }

  const saveCategories = async (categories: Category[], track = true) => {
    const before = lookup(get().categories)
    set((state) => ({ categories: merge(state.categories, categories).sort(byOrder) }))
    if (track) touch('category')
    await sync().save('category', categories, before)
  }

  const saveClassBlocks = async (blocks: ClassBlock[]) => {
    const before = lookup(get().classBlocks)
    set((state) => ({ classBlocks: merge(state.classBlocks, blocks) }))
    touch('class')
    await sync().save('classBlock', blocks, before)
  }

  return {
    ready: false,
    error: null,
    ...EMPTY,
    activity: [],

    attach: async (next, nextTracker) => {
      engine = next
      stopActivity?.()
      tracker = nextTracker ?? null
      stopActivity = nextTracker ? nextTracker.subscribe(() => set({ activity: nextTracker.events() })) : null
      set({ activity: nextTracker?.events() ?? [] })
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
      stopActivity?.()
      stopActivity = null
      tracker = null
      set({ ready: false, error: null, ...EMPTY, activity: [] })
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
        false,
      )
    },

    offerLocalImport: async () => {
      const current = sync()
      if (get().tasks.length > 0 || (await current.cache.getMeta(LEGACY_ANSWERED_KEY))) return
      const data = await readLegacyData().catch(() => null)
      if (data && engine === current) useLegacyImport.setState({ offer: data })
    },

    answerLocalImport: async (userId, data) => {
      const current = sync()
      useLegacyImport.setState({ offer: null })
      await current.cache.setMeta(LEGACY_ANSWERED_KEY, data ? 'imported' : 'declined')
      if (!data) return
      const plan = planLegacyImport(data, get().categories)
      // Categories first: the outbox is ordered, and tasks reference them.
      await saveCategories(plan.categories)
      await saveClassBlocks(plan.classBlocks)
      await persist(plan.tasks)
      await markLegacyImported(userId)
    },

    syncNow: () => sync().sync(),

    createTask: async (draft) => {
      const task = { ...makeTask(draft), sortOrder: nextSortOrder(get().tasks) }
      await persist([task])
      return task
    },

    saveTask: async (task) => {
      // A task the store hasn't seen yet is new: it joins the end of "My order".
      const isNew = !get().tasks.some((existing) => existing.id === task.id)
      await persist([isNew ? { ...task, sortOrder: nextSortOrder(get().tasks) } : task])
    },

    reorderTasks: async (updates) => {
      const byId = new Map(updates.map((update) => [update.id, update.sortOrder]))
      const changed = get().tasks.flatMap((task) => {
        const sortOrder = byId.get(task.id)
        return sortOrder === undefined || sortOrder === task.sortOrder ? [] : [{ ...task, sortOrder }]
      })
      if (changed.length > 0) await persist(changed)
    },

    deleteTasks: async (ids) => {
      const removed = get().tasks.filter((task) => ids.includes(task.id))
      set((state) => ({ tasks: state.tasks.filter((task) => !ids.includes(task.id)) }))
      touch('task')
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
      touch('class')
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
