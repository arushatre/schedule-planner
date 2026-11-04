import type { BackupData } from '@/lib/backup'
import type { AnyRecord, Entity, OutboxEntry } from '@/sync/cache'
import { sameRecord } from '@/sync/records'
import type { Category, ClassBlock, Task } from '@/types/model'

/*
 * Pure sync bookkeeping for the phone app, mirroring src/sync/engine.ts: an ordered outbox that
 * coalesces writes to the same record, and merges of server data that never overwrite a record
 * with a pending local write. No I/O here, so it runs under the root vitest suite.
 */

export type { Entity, OutboxEntry }

const LIST = { task: 'tasks', category: 'categories', classBlock: 'classBlocks' } as const

const listOf = (data: BackupData, entity: Entity): AnyRecord[] => data[LIST[entity]]

function withList(data: BackupData, entity: Entity, list: AnyRecord[]): BackupData {
  if (entity === 'task') return { ...data, tasks: list as Task[] }
  if (entity === 'category') return { ...data, categories: list as Category[] }
  return { ...data, classBlocks: list as ClassBlock[] }
}

const key = (entity: Entity, id: string): string => `${entity}:${id}`

export const pendingKeys = (outbox: OutboxEntry[]): Set<string> =>
  new Set(outbox.map((entry) => key(entry.entity, entry.id)))

export interface Write {
  entity: Entity
  id: string
  op: OutboxEntry['op']
  payload: AnyRecord | null
  /** Last server-confirmed state; null = the record did not exist. */
  before: AnyRecord | null
}

/**
 * Appends a write, or folds it into the entry already pending for that record. The entry keeps its
 * queue position (a later write may depend on the record existing) and its oldest `before`.
 */
export function enqueue(outbox: OutboxEntry[], write: Write, now = Date.now()): OutboxEntry[] {
  const index = outbox.findIndex((entry) => entry.entity === write.entity && entry.id === write.id)
  const existing = outbox[index]
  if (!existing) {
    const seq = outbox.reduce((max, entry) => Math.max(max, entry.seq ?? 0), 0) + 1
    return [...outbox, { ...write, seq, rev: 0, attempts: 0, createdAt: now }]
  }
  // A create then a delete still sends the delete: the create may already be in flight.
  const next = { ...existing, op: write.op, payload: write.payload, rev: existing.rev + 1 }
  return outbox.map((entry, i) => (i === index ? next : entry))
}

/** The server accepted `sent`. If the record changed while in flight, keep the newer write. */
export function confirm(outbox: OutboxEntry[], sent: OutboxEntry): OutboxEntry[] {
  const current = outbox.find((entry) => entry.seq === sent.seq)
  if (!current) return outbox
  if (current.rev === sent.rev) return outbox.filter((entry) => entry !== current)
  const before = sent.op === 'delete' ? null : sent.payload
  return outbox.map((entry) => (entry === current ? { ...entry, before, attempts: 0 } : entry))
}

/** The server refused `sent` for good: drop it and put the record back as the server has it. */
export function reject(data: BackupData, outbox: OutboxEntry[], sent: OutboxEntry): { data: BackupData; outbox: OutboxEntry[] } {
  const current = outbox.find((entry) => entry.seq === sent.seq) ?? sent
  const rest = outbox.filter((entry) => entry.seq !== sent.seq)
  const list = listOf(data, sent.entity).filter((record) => record.id !== sent.id)
  return { data: withList(data, sent.entity, current.before ? [...list, current.before] : list), outbox: rest }
}

export function bumpAttempts(outbox: OutboxEntry[], sent: OutboxEntry, attempts: number): OutboxEntry[] {
  return outbox.map((entry) => (entry.seq === sent.seq ? { ...entry, attempts } : entry))
}

/** Applies server changes (realtime), skipping records with pending writes. Same object back if nothing changed. */
export function applyServer(data: BackupData, outbox: OutboxEntry[], entity: Entity, put: AnyRecord[], remove: string[]): BackupData {
  const pending = pendingKeys(outbox)
  const free = (id: string) => !pending.has(key(entity, id))
  const current = listOf(data, entity)
  const byId = new Map(current.map((record) => [record.id, record]))
  const updates = new Map(put.filter((record) => free(record.id) && !sameRecord(byId.get(record.id), record)).map((record) => [record.id, record]))
  const removed = new Set(remove.filter((id) => free(id) && byId.has(id)))
  if (updates.size === 0 && removed.size === 0) return data
  const kept = current.flatMap((record) => (removed.has(record.id) ? [] : [updates.get(record.id) ?? record]))
  const added = [...updates.values()].filter((record) => !byId.has(record.id))
  return withList(data, entity, [...kept, ...added])
}

/**
 * Reconciles with a full server snapshot: the server wins, except for records with pending local
 * writes, which keep their local state (including pending deletes). Same object back if nothing changed.
 */
export function mergePull(data: BackupData, outbox: OutboxEntry[], server: BackupData): BackupData {
  let next = data
  for (const entity of Object.keys(LIST) as Entity[]) {
    const remote = listOf(server, entity)
    const remoteIds = new Set(remote.map((record) => record.id))
    const gone = listOf(data, entity).filter((record) => !remoteIds.has(record.id)).map((record) => record.id)
    next = applyServer(next, outbox, entity, remote, gone)
  }
  return next
}

export interface Change {
  data: BackupData
  writes: Write[]
}

type AnyList = AnyRecord[]
const ORDER: Entity[] = ['category', 'classBlock', 'task']

/** Adds records as new. Categories are queued first, so no task reaches the server before its category. */
export function addAll(current: BackupData, added: BackupData): Change {
  let data = current
  const writes: Write[] = []
  for (const entity of ORDER) {
    const records = listOf(added, entity)
    data = withList(data, entity, [...listOf(data, entity), ...records])
    writes.push(...records.map((record): Write => ({ entity, id: record.id, op: 'upsert', payload: record, before: null })))
  }
  return { data, writes }
}

/**
 * Replaces everything with `next` (ids must already be UUIDs). Upserts go categories first;
 * deletes go tasks first, so a category is never removed while a task still points at it.
 */
export function replaceAllWith(current: BackupData, next: BackupData): Change {
  const upserts: Write[] = []
  const deletes: Write[] = []
  for (const entity of ORDER) {
    const before: AnyList = listOf(current, entity)
    const after: AnyList = listOf(next, entity)
    const byId = new Map(before.map((record) => [record.id, record]))
    const keep = new Set(after.map((record) => record.id))
    upserts.push(...after.map((record): Write => ({ entity, id: record.id, op: 'upsert', payload: record, before: byId.get(record.id) ?? null })))
    deletes.unshift(...before.filter((record) => !keep.has(record.id)).map((record): Write => ({ entity, id: record.id, op: 'delete', payload: null, before: record })))
  }
  return { data: next, writes: [...upserts, ...deletes] }
}
