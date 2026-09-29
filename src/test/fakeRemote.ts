import type { AnyRecord, Entity, OutboxEntry } from '@/sync/cache'
import type { RealtimeHandlers, Remote, RemoteError, Snapshot } from '@/sync/remote'
import type { Category, ClassBlock, Task } from '@/types/model'

export const NETWORK_ERROR: RemoteError = { message: 'TypeError: Failed to fetch', code: '', status: 0 }
export const RLS_ERROR: RemoteError = {
  message: 'new row violates row-level security policy',
  code: '42501',
  status: 403,
}

/** In-memory stand-in for Supabase. `failNext` scripts errors for upcoming sends. */
export class FakeRemote implements Remote {
  readonly rows: { [E in Entity]: Map<string, AnyRecord> } = {
    task: new Map(),
    category: new Map(),
    classBlock: new Map(),
  }
  readonly sent: OutboxEntry[] = []
  readonly failures: RemoteError[] = []
  fetchError: RemoteError | null = null
  handlers: RealtimeHandlers | null = null

  failNext(...errors: RemoteError[]): void {
    this.failures.push(...errors)
  }

  seed(snapshot: Partial<Snapshot>): void {
    snapshot.tasks?.forEach((task) => this.rows.task.set(task.id, task))
    snapshot.categories?.forEach((category) => this.rows.category.set(category.id, category))
    snapshot.classBlocks?.forEach((block) => this.rows.classBlock.set(block.id, block))
  }

  fetchAll = async () => {
    if (this.fetchError) return { data: null, error: this.fetchError }
    return {
      data: {
        tasks: [...this.rows.task.values()] as Task[],
        categories: [...this.rows.category.values()] as Category[],
        classBlocks: [...this.rows.classBlock.values()] as ClassBlock[],
      },
      error: null,
    }
  }

  fetchTasks = async (ids: string[]) => ({
    data: ids.flatMap((id) => {
      const task = this.rows.task.get(id)
      return task ? [task as Task] : []
    }),
    error: null,
  })

  send = async (entry: OutboxEntry) => {
    const failure = this.failures.shift()
    if (failure) return failure
    this.sent.push(structuredClone(entry))
    if (entry.op === 'delete') this.rows[entry.entity].delete(entry.id)
    else if (entry.payload) this.rows[entry.entity].set(entry.id, structuredClone(entry.payload))
    return null
  }

  subscribe = (_userId: string, handlers: RealtimeHandlers) => {
    this.handlers = handlers
    return () => {
      this.handlers = null
    }
  }

  refreshSession = async () => true
}
