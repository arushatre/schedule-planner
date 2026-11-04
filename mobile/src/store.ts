import { useSyncExternalStore } from 'react'
import { Alert } from 'react-native'

import { serializeBackup, withUuidIds } from '@/lib/backup'
import type { BackupData } from '@/lib/backup'
import { isRecurring } from '@/lib/recurrence'
import { planLegacyImport } from '@/sync/records'
import { createSupabaseRemote } from '@/sync/remote'
import type { Category, Occurrence, Task } from '@/types/model'
import { DEFAULT_PREFS, loadPrefs, markLegacyImported, readLegacy, readSaved, savePrefs, writeSaved } from './cache'
import type { Prefs } from './cache'
import { cancelAll } from './notifications'
import { addAll, enqueue, replaceAllWith } from './outbox'
import type { OutboxEntry, Write } from './outbox'
import { supabase, supabaseConfigError } from './supabase'
import { IDLE, startSync } from './sync'
import type { Local, Sync, SyncStatus } from './sync'

export type { Mode, Prefs } from './cache'

export interface User {
  id: string
  email: string
}

interface State extends BackupData {
  /** The signed-in user's data has been loaded from this phone. */
  ready: boolean
  prefs: Prefs
  auth: 'loading' | 'signedOut' | 'signedIn'
  user: User | null
  sync: SyncStatus
}

const SEED: Pick<Category, 'name' | 'colorKey'>[] = [
  { name: 'School', colorKey: 'slate' },
  { name: 'Personal', colorKey: 'moss' },
  { name: 'Work', colorKey: 'clay' },
]

const EMPTY: BackupData = { tasks: [], categories: [], classBlocks: [] }

let state: State = { ready: false, ...EMPTY, prefs: DEFAULT_PREFS, auth: 'loading', user: null, sync: IDLE }
const listeners = new Set<() => void>()

function emit(next: Partial<State>): void {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

interface Session {
  user: User
  outbox: OutboxEntry[]
  pulledAt: number | null
  sync: Sync | null
  /** The pre-accounts data offer was handled this session (asked at most once per launch). */
  offered: boolean
}

let session: Session | null = null

const dataOf = (): BackupData => ({ tasks: state.tasks, categories: state.categories, classBlocks: state.classBlocks })

/** Updates state and persists data + outbox together. Synchronous, so a change survives the app being killed. */
function persist(owner: Session, next: Local): void {
  if (session !== owner) return
  owner.outbox = next.outbox
  emit({ ...next.data, sync: { ...state.sync, pending: next.outbox.length } })
  writeSaved(owner.user.id, next, owner.pulledAt)
}

/** Queues local writes for the server and applies `data` optimistically. */
function commit(data: BackupData, writes: Write[]): void {
  if (!session) {
    console.warn('Daybook: ignored a change made while signed out')
    return
  }
  const outbox = writes.reduce(enqueue, session.outbox)
  persist(session, { data, outbox })
  session.sync?.flush()
}

const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some((existing) => existing.id === item.id) ? list.map((existing) => (existing.id === item.id ? item : existing)) : [...list, item]

// ---------------------------------------------------------------------------
// First successful pull on this phone: seed, and offer data saved before accounts
// ---------------------------------------------------------------------------

/** Adds imported records; categories with the same name as an existing one are reused. */
function importData(raw: BackupData): void {
  const change = addAll(dataOf(), planLegacyImport(raw, state.categories))
  commit(change.data, change.writes)
}

/** After the first successful pull of each session; `first` = first ever for this user on this phone. */
function afterPull(user: User, first: boolean): void {
  const legacy = readLegacy()
  const markImported = () => markLegacyImported(user.id)
  const empty = state.tasks.length === 0 && state.classBlocks.length === 0
  if (legacy && empty) {
    importData(legacy)
    markImported()
  }
  if (first && state.categories.length === 0) {
    const now = Date.now()
    importData({ ...EMPTY, categories: SEED.map((seed, order) => ({ ...seed, id: crypto.randomUUID(), archived: false, order, createdAt: now })) })
  }
  if (legacy && !empty) {
    Alert.alert(
      'Add this phone’s tasks to your account?',
      `${legacy.tasks.length} tasks were saved on this phone before you signed in. Categories with the same name are combined. If you choose Not now, Daybook asks again next time you open it.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Add them',
          onPress: () => {
            if (session?.user.id !== user.id) return
            importData(legacy)
            markImported()
          },
        },
      ],
    )
  }
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

function startSession(user: User): void {
  const saved = readSaved(user.id)
  const owner: Session = { user, outbox: saved.outbox, pulledAt: saved.pulledAt, sync: null, offered: false }
  session = owner
  emit({ ...saved.data, ready: true, auth: 'signedIn', user, sync: { ...IDLE, pending: saved.outbox.length } })
  owner.sync = startSync(user.id, createSupabaseRemote(supabase), {
    read: () => ({ data: dataOf(), outbox: owner.outbox }),
    write: (next) => persist(owner, next),
    onStatus: (status) => {
      if (session === owner) emit({ sync: status })
    },
    onPulled: () => {
      if (session !== owner || owner.offered) return
      owner.offered = true
      const first = owner.pulledAt === null
      if (first) {
        owner.pulledAt = Date.now()
        persist(owner, { data: dataOf(), outbox: owner.outbox })
      }
      afterPull(user, first)
    },
    onRejected: (_entity, error) =>
      Alert.alert('A change couldn’t be saved', `The server refused it, so it was undone.\n\n${error.message}`),
  })
  void owner.sync.sync()
}

function endSession(): void {
  session?.sync?.stop()
  session = null
  emit({ ...EMPTY, ready: false, auth: 'signedOut', user: null, sync: IDLE })
  void cancelAll()
}

function onUser(user: User | null): void {
  if (user && session?.user.id === user.id) {
    if (session.user.email !== user.email) emit({ user })
    return
  }
  if (session) endSession()
  if (user) startSession(user)
  else emit({ auth: 'signedOut' })
}

let loaded = false

/** Loads preferences and follows the auth session (signed in → this user's cached data, then sync). */
export function load(): void {
  if (loaded) return
  loaded = true
  emit({ prefs: loadPrefs() })
  if (supabaseConfigError) {
    emit({ auth: 'signedOut' })
    return
  }
  supabase.auth.onAuthStateChange((_event, next) => {
    const user = next?.user ? { id: next.user.id, email: next.user.email ?? '' } : null
    // Supabase warns against doing work inside this callback; defer it.
    setTimeout(() => onUser(user), 0)
  })
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

/** Pushes pending changes and pulls the latest. Resolves (never rejects) when done; status is in `sync`. */
export function syncNow(): Promise<void> {
  return session?.sync?.sync() ?? Promise.resolve()
}

/** Signs out of this phone only. Unsynced changes stay queued for this account on this phone. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  // Supabase drops the local session even when the server can't be reached.
  if (error) console.warn('Daybook: sign-out could not reach the server', error)
  onUser(null)
}

export function saveTask(task: Task): void {
  const next = { ...task, updatedAt: Date.now() }
  const before = state.tasks.find((existing) => existing.id === task.id) ?? null
  commit({ ...dataOf(), tasks: upsert(state.tasks, next) }, [{ entity: 'task', id: next.id, op: 'upsert', payload: next, before }])
}

export function deleteTask(id: string): void {
  const before = state.tasks.find((task) => task.id === id)
  if (!before) return
  commit({ ...dataOf(), tasks: state.tasks.filter((task) => task.id !== id) }, [{ entity: 'task', id, op: 'delete', payload: null, before }])
}

/** Same rule as the web app: recurring tasks complete per occurrence, others via status. */
export function setDone(occ: Occurrence, done: boolean): void {
  const task = state.tasks.find((existing) => existing.id === occ.task.id) ?? occ.task
  if (isRecurring(task) && occ.originalDate) {
    const dates = new Set(task.completedDates)
    if (done) dates.add(occ.originalDate)
    else dates.delete(occ.originalDate)
    saveTask({ ...task, completedDates: [...dates] })
  } else {
    saveTask({ ...task, status: done ? 'done' : 'todo', completedAt: done ? Date.now() : null })
  }
}

/** Replaces the account's data with an imported backup (keeps current categories if it has none). */
export function replaceAll(raw: BackupData): void {
  const change = replaceAllWith(dataOf(), withUuidIds(raw.categories.length > 0 ? raw : { ...raw, categories: state.categories }))
  commit(change.data, change.writes)
}

export function exportData(): string {
  return serializeBackup(dataOf())
}

export function setPrefs(patch: Partial<Prefs>): void {
  emit({ prefs: { ...state.prefs, ...patch } })
  savePrefs(state.prefs)
}
