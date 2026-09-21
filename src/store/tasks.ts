import { create } from 'zustand'
import { nanoid } from 'nanoid'

import * as repo from '@/db/repo'
import { isRecurring } from '@/lib/recurrence'
import { makeTask } from '@/lib/tasks'
import type { PaletteKey } from '@/lib/palette'
import type { Category, Occurrence, Task } from '@/types/model'


export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'completedDates' | 'exceptions'>

/** Restores previous task state; returned from mutations so the UI can offer Undo. */
export type Undo = () => Promise<void>

interface TasksState {
  ready: boolean
  error: string | null
  tasks: Task[]
  categories: Category[]

  init: () => Promise<void>
  createTask: (draft: TaskDraft) => Promise<Task>
  saveTask: (task: Task) => Promise<void>
  deleteTasks: (ids: string[]) => Promise<Undo>
  setOccurrenceDone: (occ: Occurrence, done: boolean) => Promise<Undo>
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>
  moveOccurrence: (occ: Occurrence, toDate: string) => Promise<Undo>
  createCategory: (name: string, colorKey: PaletteKey) => Promise<Category>
  saveCategory: (category: Category) => Promise<void>
  importAll: (tasks: Task[], categories: Category[]) => Promise<void>
}

export const useTasksStore = create<TasksState>()((set, get) => {
  const upsert = (tasks: Task[]) =>
    set((state) => {
      const byId = new Map(state.tasks.map((task) => [task.id, task]))
      tasks.forEach((task) => byId.set(task.id, task))
      return { tasks: [...byId.values()] }
    })

  const persist = async (tasks: Task[]) => {
    const stamped = tasks.map((task) => ({ ...task, updatedAt: Date.now() }))
    await repo.putTasks(stamped)
    upsert(stamped)
  }

  const snapshotUndo = (before: Task[]): Undo => async () => {
    await repo.putTasks(before)
    upsert(before)
  }

  const find = (id: string): Task => {
    const task = get().tasks.find((candidate) => candidate.id === id)
    if (!task) throw new Error(`Task ${id} not found`)
    return task
  }

  return {
    ready: false,
    error: null,
    tasks: [],
    categories: [],

    init: async () => {
      try {
        await repo.ensureSeed()
        const { tasks, categories } = await repo.loadAll()
        set({ tasks, categories, ready: true, error: null })
      } catch (error) {
        set({
          ready: true,
          error: error instanceof Error ? error.message : 'Could not open local storage.',
        })
      }
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
      await repo.deleteTasks(ids)
      set((state) => ({ tasks: state.tasks.filter((task) => !ids.includes(task.id)) }))
      return async () => {
        await repo.putTasks(removed)
        upsert(removed)
      }
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
          status: done ? 'done' : 'not_started',
          completedAt: done ? Date.now() : null,
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
        id: nanoid(10),
        name: name.trim(),
        colorKey,
        archived: false,
        order: categories.reduce((max, current) => Math.max(max, current.order), -1) + 1,
        createdAt: Date.now(),
      }
      await repo.putCategory(category)
      set({ categories: [...categories, category] })
      return category
    },

    saveCategory: async (category) => {
      await repo.putCategory(category)
      set((state) => ({
        categories: state.categories.map((current) => (current.id === category.id ? category : current)),
      }))
    },

    importAll: async (tasks, categories) => {
      await repo.replaceAll(tasks, categories)
      set({ tasks, categories: [...categories].sort((a, b) => a.order - b.order) })
    },
  }
})
