import Dexie from 'dexie'
import type { EntityTable, Table } from 'dexie'

import type { Category, ClassBlock, Task } from '@/types/model'

export type Entity = 'task' | 'category' | 'classBlock'

export interface EntityRecord {
  task: Task
  category: Category
  classBlock: ClassBlock
}

export type AnyRecord = EntityRecord[Entity]

/** One pending write. A newer write to the same record replaces `payload` but keeps `before`. */
export interface OutboxEntry {
  seq?: number
  entity: Entity
  id: string
  op: 'upsert' | 'delete'
  payload: AnyRecord | null
  /** Last server-confirmed state, restored if the server rejects the write; null = did not exist. */
  before: AnyRecord | null
  /** Bumped on every coalesce so a flush can tell the entry changed while it was in flight. */
  rev: number
  attempts: number
  createdAt: number
}

interface MetaRow {
  key: string
  value: string
}

/** Per-user IndexedDB cache: the app boots from here, then reconciles with Supabase. */
export class CacheDb extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  categories!: EntityTable<Category, 'id'>
  classBlocks!: EntityTable<ClassBlock, 'id'>
  outbox!: EntityTable<OutboxEntry, 'seq'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor(userId: string) {
    super(`daybook:${userId}`)
    this.version(1).stores({
      tasks: 'id',
      categories: 'id',
      classBlocks: 'id',
      outbox: '++seq, [entity+id]',
      meta: 'key',
    })
  }

  /** The three record tables share one shape: keyed by string `id`. */
  tableFor(entity: Entity): Table<AnyRecord, string> {
    const tables = { task: this.tasks, category: this.categories, classBlock: this.classBlocks }
    return tables[entity] as unknown as Table<AnyRecord, string>
  }

  async getMeta(key: string): Promise<string | null> {
    return (await this.meta.get(key))?.value ?? null
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.meta.put({ key, value })
  }
}

/**
 * Queues a write for `entity`/`id`, coalescing with any entry already pending for it.
 * Must run inside a Dexie transaction that includes the outbox table.
 */
export async function enqueue(
  cache: CacheDb,
  entity: Entity,
  id: string,
  op: OutboxEntry['op'],
  payload: AnyRecord | null,
  before: AnyRecord | null,
): Promise<void> {
  const existing = await cache.outbox.where('[entity+id]').equals([entity, id]).first()
  if (!existing) {
    await cache.outbox.add({ entity, id, op, payload, before, rev: 0, attempts: 0, createdAt: Date.now() })
    return
  }
  // Keep the queue position (a later write may depend on this record existing) and the oldest `before`.
  // A create followed by a delete still sends the delete: the create may already be in flight,
  // and deleting a row the server never saw is a harmless no-op.
  if (existing.seq === undefined) return
  await cache.outbox.update(existing.seq, { op, payload, rev: existing.rev + 1 })
}
