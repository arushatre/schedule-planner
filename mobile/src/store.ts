import Storage from 'expo-sqlite/kv-store'
import { useSyncExternalStore } from 'react'

import { DEFAULT_APPEARANCE, parseAppearance } from '@/lib/appearance'
import type { Appearance } from '@/lib/appearance'
import { parseBackup, serializeBackup } from '@/lib/backup'
import type { BackupData } from '@/lib/backup'
import { isRecurring } from '@/lib/recurrence'
import type { Category, Occurrence, Task } from '@/types/model'

export type Mode = 'system' | 'light' | 'dark'

export interface Prefs {
  appearance: Appearance
  mode: Mode
  notifications: boolean
  briefing: boolean
}

interface State extends BackupData {
  ready: boolean
  prefs: Prefs
}

// Data is stored in the same format as a web backup file, so the phone and the
// laptop exchange data by exporting on one and importing on the other.
const DATA_KEY = 'daybook:data'
const PREFS_KEY = 'daybook:prefs'

const SEED: Pick<Category, 'name' | 'colorKey'>[] = [
  { name: 'School', colorKey: 'slate' },
  { name: 'Personal', colorKey: 'moss' },
  { name: 'Work', colorKey: 'clay' },
]

const DEFAULT_PREFS: Prefs = { appearance: DEFAULT_APPEARANCE, mode: 'system', notifications: false, briefing: true }

let state: State = { ready: false, tasks: [], categories: [], classBlocks: [], prefs: DEFAULT_PREFS }
const listeners = new Set<() => void>()

function emit(next: Partial<State>): void {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

function saveData(next: BackupData): void {
  emit({ tasks: next.tasks, categories: next.categories, classBlocks: next.classBlocks })
  // Synchronous so a change isn't lost if the app is killed right after it.
  Storage.setItemSync(DATA_KEY, exportData())
}

function loadPrefs(raw: string | null): Prefs {
  try {
    const parsed = JSON.parse(raw ?? '{}') as Partial<Prefs>
    return {
      appearance: parseAppearance(JSON.stringify(parsed.appearance ?? {})),
      mode: parsed.mode === 'light' || parsed.mode === 'dark' ? parsed.mode : 'system',
      notifications: parsed.notifications === true,
      briefing: parsed.briefing !== false,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function load(): void {
  const raw = Storage.getItemSync(DATA_KEY)
  let data: BackupData = { tasks: [], categories: [], classBlocks: [] }
  try {
    if (raw) data = parseBackup(raw)
  } catch {
    // Unreadable data: keep a copy rather than overwrite it, and start empty.
    Storage.setItemSync(`${DATA_KEY}:corrupt:${Date.now()}`, raw ?? '')
  }
  if (data.categories.length === 0) {
    const now = Date.now()
    data.categories = SEED.map((seed, order) => ({ ...seed, id: crypto.randomUUID(), archived: false, order, createdAt: now }))
  }
  emit({ ready: true, prefs: loadPrefs(Storage.getItemSync(PREFS_KEY)) })
  saveData(data)
}

export function useStore(): State {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

export const getState = (): State => state

export function saveTask(task: Task): void {
  const next = { ...task, updatedAt: Date.now() }
  const exists = state.tasks.some((existing) => existing.id === task.id)
  saveData({ ...state, tasks: exists ? state.tasks.map((t) => (t.id === task.id ? next : t)) : [...state.tasks, next] })
}

export function deleteTask(id: string): void {
  saveData({ ...state, tasks: state.tasks.filter((task) => task.id !== id) })
}

/** Same rule as the web app: recurring tasks complete per occurrence, others via status. */
export function setDone(occ: Occurrence, done: boolean): void {
  const task = occ.task
  if (isRecurring(task) && occ.originalDate) {
    const dates = new Set(task.completedDates)
    if (done) dates.add(occ.originalDate)
    else dates.delete(occ.originalDate)
    saveTask({ ...task, completedDates: [...dates] })
  } else {
    saveTask({ ...task, status: done ? 'done' : 'todo', completedAt: done ? Date.now() : null })
  }
}

/** Replaces everything with an imported backup (keeps current categories if it has none). */
export function replaceAll(data: BackupData): void {
  saveData(data.categories.length > 0 ? data : { ...data, categories: state.categories })
}

export function exportData(): string {
  return serializeBackup({ tasks: state.tasks, categories: state.categories, classBlocks: state.classBlocks })
}

export function setPrefs(patch: Partial<Prefs>): void {
  emit({ prefs: { ...state.prefs, ...patch } })
  Storage.setItemSync(PREFS_KEY, JSON.stringify(state.prefs))
}
