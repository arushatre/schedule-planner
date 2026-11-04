import { AppState } from 'react-native'

import type { BackupData } from '@/lib/backup'
import type { AnyRecord, Entity, OutboxEntry } from '@/sync/cache'
import { classifyError } from '@/sync/remote'
import type { Remote, RemoteError } from '@/sync/remote'
import { applyServer, bumpAttempts, confirm, mergePull, reject } from './outbox'

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error'
  /** Writes waiting to reach the server. */
  pending: number
  lastError: string | null
  /** Last successful pull in this session; null until the first one. */
  lastPulledAt: number | null
}

export const IDLE: SyncStatus = { state: 'idle', pending: 0, lastError: null, lastPulledAt: null }

export interface Local {
  data: BackupData
  outbox: OutboxEntry[]
}

/** The store side of sync: reads and atomically persists the user's data + outbox. */
export interface SyncHost {
  read: () => Local
  write: (next: Local) => void
  onStatus: (status: SyncStatus) => void
  /** After every successful pull (first-run seeding and import hang off this). */
  onPulled: () => void
  /** A write the server refused for good; the record has already been rolled back. */
  onRejected: (entity: Entity, error: RemoteError) => void
}

export interface Sync {
  /** Pushes pending writes, then pulls. Resolves when done; never rejects. */
  sync: () => Promise<void>
  /** Starts pushing pending writes in the background (after a local change). */
  flush: () => void
  stop: () => void
}

const MAX_BACKOFF_MS = 30_000
const REALTIME_BATCH_MS = 150

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/**
 * Offline-first sync for one signed-in user, with the semantics of src/sync/engine.ts: the outbox
 * drains in order, transient failures back off and retry, permanent ones roll the record back,
 * and pulls/realtime never overwrite a record with a pending local write.
 */
export function startSync(userId: string, remote: Remote, host: SyncHost): Sync {
  let status: SyncStatus = { ...IDLE, pending: host.read().outbox.length }
  let stopped = false
  let flushing: Promise<void> | null = null
  let flushAgain = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let realtimeTimer: ReturnType<typeof setTimeout> | null = null
  const realtimeTaskIds = new Set<string>()
  /** Consecutive failed reads, for backoff while offline. */
  let readFailures = 0

  const setStatus = (next: Partial<SyncStatus>) => {
    if (stopped) return
    status = { ...status, ...next, pending: host.read().outbox.length }
    host.onStatus(status)
  }

  const scheduleRetry = (attempts: number) => {
    if (retryTimer) clearTimeout(retryTimer)
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, attempts - 1))
    retryTimer = setTimeout(() => {
      retryTimer = null
      void sync()
    }, delay)
  }

  const drain = async (): Promise<void> => {
    while (!stopped) {
      const entry = host.read().outbox[0]
      if (!entry) break
      setStatus({ state: 'syncing' })
      const error = await remote.send(entry)
      if (stopped) return
      const local = host.read()
      if (!error) {
        host.write({ data: local.data, outbox: confirm(local.outbox, entry) })
        continue
      }
      const kind = classifyError(error)
      if (kind === 'auth' && entry.attempts === 0 && (await remote.refreshSession())) {
        host.write({ data: host.read().data, outbox: bumpAttempts(host.read().outbox, entry, 1) })
        continue
      }
      if (kind === 'permanent') {
        host.write(reject(local.data, local.outbox, entry))
        host.onRejected(entry.entity, error)
        continue
      }
      host.write({ data: local.data, outbox: bumpAttempts(local.outbox, entry, entry.attempts + 1) })
      setStatus({ state: kind === 'offline' ? 'offline' : 'error', lastError: error.message })
      scheduleRetry(entry.attempts + 1)
      return
    }
    if (status.state === 'syncing') setStatus({ state: 'idle', lastError: null })
  }

  const runFlush = (): Promise<void> => {
    if (flushing) {
      flushAgain = true
      return flushing
    }
    flushing = drain().finally(() => {
      flushing = null
      if (flushAgain && !stopped) {
        flushAgain = false
        flushInBackground()
      }
    })
    return flushing
  }

  const flushInBackground = () => {
    runFlush().catch((error: unknown) => setStatus({ state: 'error', lastError: message(error) }))
  }

  const pull = async (): Promise<void> => {
    setStatus({ state: 'syncing' })
    const result = await remote.fetchAll()
    if (stopped) return
    if (result.error) {
      const kind = classifyError(result.error)
      setStatus({ state: kind === 'offline' ? 'offline' : 'error', lastError: result.error.message })
      if (kind !== 'permanent') scheduleRetry(++readFailures)
      return
    }
    readFailures = 0
    const local = host.read()
    const data = mergePull(local.data, local.outbox, result.data)
    if (data !== local.data) host.write({ data, outbox: local.outbox })
    // A write still queued (in flight or waiting to retry) keeps its own status.
    const settled = !flushing && local.outbox.length === 0
    setStatus(settled ? { state: 'idle', lastError: null, lastPulledAt: Date.now() } : { lastPulledAt: Date.now() })
    host.onPulled()
  }

  const sync = async (): Promise<void> => {
    try {
      setStatus({ state: 'syncing' })
      await runFlush()
      // Records still queued keep their local state through the merge.
      if (!stopped && status.state !== 'offline') await pull()
    } catch (error) {
      setStatus({ state: 'error', lastError: message(error) })
    }
  }

  const applyRemote = (entity: Entity, put: AnyRecord[], remove: string[]) => {
    if (stopped) return
    const local = host.read()
    const data = applyServer(local.data, local.outbox, entity, put, remove)
    if (data !== local.data) host.write({ data, outbox: local.outbox })
  }

  const fetchRealtimeTasks = async () => {
    const ids = [...realtimeTaskIds]
    realtimeTaskIds.clear()
    const result = await remote.fetchTasks(ids)
    if (result.error) {
      setStatus({ state: classifyError(result.error) === 'offline' ? 'offline' : 'error', lastError: result.error.message })
      scheduleRetry(++readFailures)
      return
    }
    // A task missing from the result was deleted after the event; its delete event removes it.
    applyRemote('task', result.data, [])
  }

  const unsubscribe = remote.subscribe(userId, {
    onChange: (entity, id, record) => {
      if (record) return applyRemote(entity, [record], [])
      // Task events don't carry subtasks/tags/overrides: batch the ids and refetch whole tasks.
      realtimeTaskIds.add(id)
      if (realtimeTimer) return
      realtimeTimer = setTimeout(() => {
        realtimeTimer = null
        fetchRealtimeTasks().catch((error: unknown) => setStatus({ state: 'error', lastError: message(error) }))
      }, REALTIME_BATCH_MS)
    },
    onDelete: (entity, id) => applyRemote(entity, [], [id]),
  })

  // Coming back to the app: push what's queued and catch up on changes made elsewhere.
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void sync()
  })

  return {
    sync,
    flush: flushInBackground,
    stop: () => {
      stopped = true
      unsubscribe()
      appState.remove()
      if (retryTimer) clearTimeout(retryTimer)
      if (realtimeTimer) clearTimeout(realtimeTimer)
    },
  }
}
