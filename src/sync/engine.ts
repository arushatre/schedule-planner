import type { Category, ClassBlock, Task } from '@/types/model'
import { enqueue } from './cache'
import type { AnyRecord, CacheDb, Entity, EntityRecord, OutboxEntry } from './cache'
import { classifyError } from './remote'
import type { Remote, RemoteError, Snapshot } from './remote'

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncStatus {
  state: SyncState
  /** Writes waiting to reach the server. */
  pending: number
  lastError: string | null
  /** When this session last reconciled with the server; null until the first successful pull. */
  lastPulledAt: number | null
}

export interface EntityPatch<T> {
  put: T[]
  remove: string[]
}

/** Changes the engine made to the cache on its own (pull, realtime, other tabs, rollbacks). */
export interface Patch {
  task: EntityPatch<Task>
  category: EntityPatch<Category>
  classBlock: EntityPatch<ClassBlock>
}

export interface SyncEngineOptions {
  userId: string
  cache: CacheDb
  remote: Remote
  onPatch: (patch: Patch) => void
  onStatus: (status: SyncStatus) => void
  /** A write the server refused for good; the cache and `onPatch` have already rolled it back. */
  onRejected: (entity: Entity, error: RemoteError) => void
  isOnline?: () => boolean
}

const ENTITIES: Entity[] = ['task', 'category', 'classBlock']
const MAX_BACKOFF_MS = 30_000
const REALTIME_BATCH_MS = 150

export const emptyPatch = (): Patch => ({
  task: { put: [], remove: [] },
  category: { put: [], remove: [] },
  classBlock: { put: [], remove: [] },
})

const isEmpty = (patch: Patch): boolean =>
  ENTITIES.every((entity) => patch[entity].put.length === 0 && patch[entity].remove.length === 0)

const pendingKey = (entity: Entity, id: string): string => `${entity}:${id}`

/** Key-order-independent comparison so identical records don't trigger re-renders. */
function sameRecord(a: unknown, b: unknown): boolean {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable)
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([x], [y]) => (x < y ? -1 : 1))
          .map(([key, inner]) => [key, stable(inner)]),
      )
    }
    return value
  }
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b))
}

function addToPatch(patch: Patch, entity: Entity, put: AnyRecord[], remove: string[]): void {
  ;(patch[entity].put as AnyRecord[]).push(...put)
  patch[entity].remove.push(...remove)
}

/**
 * Offline-first sync for one signed-in user.
 *
 * Local writes land in the IndexedDB cache and an outbox in one transaction, and the UI
 * has already updated optimistically. The outbox drains in order whenever the browser is
 * online: transient failures back off and retry, permanent ones roll the record back to
 * its last server-confirmed state. Pulls, realtime events, and other tabs never overwrite
 * a record that still has a pending local write.
 */
export class SyncEngine {
  private readonly options: SyncEngineOptions
  readonly cache: CacheDb
  private readonly remote: Remote
  private status: SyncStatus = { state: 'idle', pending: 0, lastError: null, lastPulledAt: null }
  private flushing: Promise<void> | null = null
  private flushAgain = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private realtimeTimer: ReturnType<typeof setTimeout> | null = null
  private readonly realtimeTaskIds = new Set<string>()
  private channel: BroadcastChannel | null = null
  private unsubscribe: (() => void) | null = null
  private stopped = false

  constructor(options: SyncEngineOptions) {
    this.options = options
    this.cache = options.cache
    this.remote = options.remote
  }

  private get online(): boolean {
    return this.options.isOnline ? this.options.isOnline() : navigator.onLine
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Starts listening and runs the first sync; resolves when that sync finishes. */
  start(): Promise<void> {
    this.stopped = false
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
    document.addEventListener('visibilitychange', this.handleVisibility)
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`daybook:${this.options.userId}`)
      this.channel.onmessage = (event: MessageEvent<{ entity: Entity; ids: string[] }>) => {
        void this.applyFromOtherTab(event.data.entity, event.data.ids)
      }
    }
    this.unsubscribe = this.remote.subscribe(this.options.userId, {
      onChange: (entity, id, record) => void this.applyRealtimeChange(entity, id, record),
      onDelete: (entity, id) => void this.applyRemote(entity, [], [id]),
    })
    void this.refreshPending()
    return this.sync()
  }

  stop(): void {
    this.stopped = true
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.channel?.close()
    this.channel = null
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.retryTimer) clearTimeout(this.retryTimer)
    if (this.realtimeTimer) clearTimeout(this.realtimeTimer)
  }

  private readonly handleOnline = () => void this.sync()
  private readonly handleOffline = () => this.setStatus({ state: 'offline' })
  private readonly handleVisibility = () => {
    if (document.visibilityState === 'visible') void this.sync()
  }

  // ---------------------------------------------------------------------------
  // Local reads and writes
  // ---------------------------------------------------------------------------

  async load(): Promise<Snapshot> {
    const [tasks, categories, classBlocks] = await Promise.all([
      this.cache.tasks.toArray(),
      this.cache.categories.toArray(),
      this.cache.classBlocks.toArray(),
    ])
    return { tasks, categories, classBlocks }
  }

  /** Writes records locally and queues them for the server. `before` is the pre-edit state (null = new). */
  async save<E extends Entity>(
    entity: E,
    records: EntityRecord[E][],
    before: (id: string) => EntityRecord[E] | null,
  ): Promise<void> {
    if (records.length === 0) return
    const table = this.cache.tableFor(entity)
    await this.cache.transaction('rw', table, this.cache.outbox, async () => {
      await table.bulkPut(records)
      for (const record of records) await enqueue(this.cache, entity, record.id, 'upsert', record, before(record.id))
    })
    this.afterLocalWrite(entity, records.map((record) => record.id))
  }

  async remove<E extends Entity>(entity: E, ids: string[], before: (id: string) => EntityRecord[E] | null): Promise<void> {
    if (ids.length === 0) return
    const table = this.cache.tableFor(entity)
    await this.cache.transaction('rw', table, this.cache.outbox, async () => {
      await table.bulkDelete(ids)
      for (const id of ids) await enqueue(this.cache, entity, id, 'delete', null, before(id))
    })
    this.afterLocalWrite(entity, ids)
  }

  private afterLocalWrite(entity: Entity, ids: string[]): void {
    this.channel?.postMessage({ entity, ids })
    void this.refreshPending()
    this.flushInBackground()
  }

  private flushInBackground(): void {
    this.flush().catch((error: unknown) => {
      if (!this.stopped) this.setStatus({ state: 'error', lastError: error instanceof Error ? error.message : String(error) })
    })
  }

  // ---------------------------------------------------------------------------
  // Push: drain the outbox
  // ---------------------------------------------------------------------------

  /** Flushes pending writes, then reconciles with the server. */
  async sync(): Promise<void> {
    try {
      await this.flush()
      if (this.online && !this.stopped) await this.pull()
    } catch (error) {
      // After stop() the cache is closed underneath in-flight work; that is expected.
      if (this.stopped) return
      this.setStatus({ state: 'error', lastError: error instanceof Error ? error.message : String(error) })
    }
  }

  flush(): Promise<void> {
    if (this.flushing) {
      this.flushAgain = true
      return this.flushing
    }
    this.flushing = this.withLock(() => this.drain()).finally(() => {
      this.flushing = null
      if (this.flushAgain && !this.stopped) {
        this.flushAgain = false
        this.flushInBackground()
      }
    })
    return this.flushing
  }

  /** One flusher per user per browser, so two tabs never send the same entry twice. */
  private async withLock(run: () => Promise<void>): Promise<void> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    if (!locks) return run()
    await locks.request(`daybook-sync:${this.options.userId}`, run)
  }

  private async drain(): Promise<void> {
    while (!this.stopped) {
      if (!this.online) {
        this.setStatus({ state: 'offline' })
        return
      }
      const entry = await this.cache.outbox.orderBy('seq').first()
      if (!entry || entry.seq === undefined) break

      this.setStatus({ state: 'syncing' })
      const error = await this.remote.send(entry)
      if (!error) {
        await this.confirm(entry)
        continue
      }

      const kind = classifyError(error)
      if (kind === 'auth' && entry.attempts === 0 && (await this.remote.refreshSession())) {
        await this.cache.outbox.update(entry.seq, { attempts: 1 })
        continue
      }
      if (kind === 'permanent') {
        await this.reject(entry, error)
        continue
      }
      await this.cache.outbox.update(entry.seq, { attempts: entry.attempts + 1 })
      this.setStatus({ state: kind === 'offline' ? 'offline' : 'error', lastError: error.message })
      this.scheduleRetry(entry.attempts + 1)
      return
    }
    await this.refreshPending()
    if (this.status.state === 'syncing') this.setStatus({ state: 'idle', lastError: null })
  }

  private async confirm(entry: OutboxEntry): Promise<void> {
    const seq = entry.seq
    if (seq === undefined) return
    await this.cache.transaction('rw', this.cache.outbox, async () => {
      const current = await this.cache.outbox.get(seq)
      if (!current) return
      if (current.rev === entry.rev) await this.cache.outbox.delete(seq)
      // Edited again while in flight: keep the newer write, and what we just sent is now the server state.
      else await this.cache.outbox.update(seq, { before: entry.op === 'delete' ? null : entry.payload, attempts: 0 })
    })
    await this.refreshPending()
  }

  private async reject(entry: OutboxEntry, error: RemoteError): Promise<void> {
    const seq = entry.seq
    if (seq === undefined) return
    const table = this.cache.tableFor(entry.entity)
    const patch = emptyPatch()
    await this.cache.transaction('rw', table, this.cache.outbox, async () => {
      const current = (await this.cache.outbox.get(seq)) ?? entry
      await this.cache.outbox.delete(seq)
      if (current.before) {
        await table.put(current.before)
        addToPatch(patch, entry.entity, [current.before], [])
      } else {
        await table.delete(entry.id)
        addToPatch(patch, entry.entity, [], [entry.id])
      }
    })
    this.options.onPatch(patch)
    this.channel?.postMessage({ entity: entry.entity, ids: [entry.id] })
    this.options.onRejected(entry.entity, error)
    await this.refreshPending()
  }

  private scheduleRetry(attempts: number): void {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, attempts - 1))
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.sync()
    }, delay)
  }

  // ---------------------------------------------------------------------------
  // Pull: reconcile the cache with the server
  // ---------------------------------------------------------------------------

  /** Replaces cached records with the server's, except those with pending writes. Returns false on failure. */
  async pull(): Promise<boolean> {
    const result = await this.remote.fetchAll()
    if (result.error) {
      const kind = classifyError(result.error)
      this.setStatus({ state: kind === 'offline' ? 'offline' : 'error', lastError: result.error.message })
      if (kind !== 'permanent') this.scheduleRetry(1)
      return false
    }
    const patch = emptyPatch()
    const tables = [this.cache.tasks, this.cache.categories, this.cache.classBlocks, this.cache.outbox]
    await this.cache.transaction('rw', tables, async () => {
      const pending = await this.pendingKeys()
      const server: { [E in Entity]: EntityRecord[E][] } = {
        task: result.data.tasks,
        category: result.data.categories,
        classBlock: result.data.classBlocks,
      }
      for (const entity of ENTITIES) {
        const table = this.cache.tableFor(entity)
        const cached = new Map<string, AnyRecord>((await table.toArray()).map((record) => [record.id, record]))
        const serverIds = new Set(server[entity].map((record) => record.id))
        const put = (server[entity] as AnyRecord[]).filter(
          (record) => !pending.has(pendingKey(entity, record.id)) && !sameRecord(cached.get(record.id), record),
        )
        const remove = [...cached.keys()].filter((id) => !serverIds.has(id) && !pending.has(pendingKey(entity, id)))
        await table.bulkPut(put)
        await table.bulkDelete(remove)
        addToPatch(patch, entity, put, remove)
      }
    })
    const pulledAt = Date.now()
    await this.cache.setMeta('pulledAt', String(pulledAt))
    if (!isEmpty(patch)) this.options.onPatch(patch)
    this.setStatus(this.status.state === 'syncing' ? { lastPulledAt: pulledAt } : { state: 'idle', lastError: null, lastPulledAt: pulledAt })
    return true
  }

  async hasPulled(): Promise<boolean> {
    return (await this.cache.getMeta('pulledAt')) !== null
  }

  private async pendingKeys(): Promise<Set<string>> {
    const entries = await this.cache.outbox.toArray()
    return new Set(entries.map((entry) => pendingKey(entry.entity, entry.id)))
  }

  // ---------------------------------------------------------------------------
  // Realtime and other tabs
  // ---------------------------------------------------------------------------

  private async applyRealtimeChange(entity: Entity, id: string, record: AnyRecord | null): Promise<void> {
    if (record) {
      await this.applyRemote(entity, [record], [])
      return
    }
    // Task events don't carry children; batch the ids and refetch the full aggregates.
    this.realtimeTaskIds.add(id)
    if (this.realtimeTimer) return
    this.realtimeTimer = setTimeout(() => {
      this.realtimeTimer = null
      const ids = [...this.realtimeTaskIds]
      this.realtimeTaskIds.clear()
      void this.remote.fetchTasks(ids).then((result) => {
        if (result.data) void this.applyRemote('task', result.data, [])
      })
    }, REALTIME_BATCH_MS)
  }

  /** Applies server-originated changes, skipping records with pending local writes. */
  private async applyRemote(entity: Entity, put: AnyRecord[], remove: string[]): Promise<void> {
    if (this.stopped) return
    const table = this.cache.tableFor(entity)
    const patch = emptyPatch()
    await this.cache.transaction('rw', table, this.cache.outbox, async () => {
      const pending = await this.pendingKeys()
      const cachedIds = new Set((await table.bulkGet(remove)).flatMap((record) => (record ? [record.id] : [])))
      const toPut: AnyRecord[] = []
      for (const record of put) {
        if (pending.has(pendingKey(entity, record.id))) continue
        if (sameRecord(await table.get(record.id), record)) continue
        toPut.push(record)
      }
      const toRemove = remove.filter((id) => cachedIds.has(id) && !pending.has(pendingKey(entity, id)))
      await table.bulkPut(toPut)
      await table.bulkDelete(toRemove)
      addToPatch(patch, entity, toPut, toRemove)
    })
    if (!isEmpty(patch)) this.options.onPatch(patch)
  }

  /** Another tab changed the shared cache: re-read those records and report them. */
  private async applyFromOtherTab(entity: Entity, ids: string[]): Promise<void> {
    const records = await this.cache.tableFor(entity).bulkGet(ids)
    const patch = emptyPatch()
    addToPatch(
      patch,
      entity,
      records.flatMap((record) => (record ? [record] : [])),
      ids.filter((_, index) => records[index] === undefined),
    )
    if (!isEmpty(patch)) this.options.onPatch(patch)
    await this.refreshPending()
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  private async refreshPending(): Promise<void> {
    if (this.stopped) return
    const pending = await this.cache.outbox.count().catch(() => this.status.pending)
    if (pending !== this.status.pending) this.setStatus({ pending })
  }

  private setStatus(next: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...next }
    this.options.onStatus(this.status)
  }
}
