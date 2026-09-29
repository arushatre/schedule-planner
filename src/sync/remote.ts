import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

import type { SupabaseClient } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { Category, ClassBlock, Task } from '@/types/model'
import type { AnyRecord, Entity, OutboxEntry } from './cache'
import {
  TASK_SELECT,
  categoryToRow,
  classBlockToRow,
  rowToCategory,
  rowToClassBlock,
  rowToTask,
  taskToPayload,
} from './mappers'
import type { TaskRowWithChildren } from './mappers'

export interface RemoteError {
  message: string
  /** Postgres / PostgREST error code, '' when the request never reached the server. */
  code: string
  /** HTTP status, 0 for network failures. */
  status: number
}

export interface Snapshot {
  tasks: Task[]
  categories: Category[]
  classBlocks: ClassBlock[]
}

export type RemoteResult<T> = { data: T; error: null } | { data: null; error: RemoteError }

export interface RealtimeHandlers {
  /** `record` is null for tasks: their children are not in the event, so the engine refetches. */
  onChange: (entity: Entity, id: string, record: AnyRecord | null) => void
  onDelete: (entity: Entity, id: string) => void
}

/** Everything the sync engine needs from the server; faked in tests. */
export interface Remote {
  fetchAll: () => Promise<RemoteResult<Snapshot>>
  fetchTasks: (ids: string[]) => Promise<RemoteResult<Task[]>>
  send: (entry: OutboxEntry) => Promise<RemoteError | null>
  subscribe: (userId: string, handlers: RealtimeHandlers) => () => void
  refreshSession: () => Promise<boolean>
}

export type ErrorKind = 'offline' | 'transient' | 'auth' | 'permanent'

export function classifyError(error: RemoteError): ErrorKind {
  if (error.status === 0) return 'offline'
  if (error.status >= 500 || error.status === 408 || error.status === 429) return 'transient'
  if (error.status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303') return 'auth'
  return 'permanent'
}

interface PostgrestLike {
  error: { message: string; code?: string } | null
  status: number
}

const toError = (response: PostgrestLike): RemoteError | null =>
  response.error ? { message: response.error.message, code: response.error.code ?? '', status: response.status } : null

const TABLE_ENTITY = { tasks: 'task', categories: 'category', class_blocks: 'classBlock' } as const

export function createSupabaseRemote(client: SupabaseClient): Remote {
  return {
    fetchAll: async () => {
      const [tasks, categories, classBlocks] = await Promise.all([
        client.from('tasks').select(TASK_SELECT).returns<TaskRowWithChildren[]>(),
        client.from('categories').select('*'),
        client.from('class_blocks').select('*'),
      ])
      const error = toError(tasks) ?? toError(categories) ?? toError(classBlocks)
      if (error) return { data: null, error }
      return {
        data: {
          tasks: (tasks.data ?? []).map(rowToTask),
          categories: (categories.data ?? []).map(rowToCategory),
          classBlocks: (classBlocks.data ?? []).map(rowToClassBlock),
        },
        error: null,
      }
    },

    fetchTasks: async (ids) => {
      const response = await client.from('tasks').select(TASK_SELECT).in('id', ids).returns<TaskRowWithChildren[]>()
      const error = toError(response)
      if (error) return { data: null, error }
      return { data: (response.data ?? []).map(rowToTask), error: null }
    },

    send: async (entry) => {
      const table = entry.entity === 'task' ? 'tasks' : entry.entity === 'category' ? 'categories' : 'class_blocks'
      if (entry.op === 'delete') return toError(await client.from(table).delete().eq('id', entry.id))
      if (!entry.payload) return null
      if (entry.entity === 'task') {
        return toError(await client.rpc('save_task', { p: taskToPayload(entry.payload as Task) }))
      }
      if (entry.entity === 'category') {
        return toError(await client.from('categories').upsert(categoryToRow(entry.payload as Category)))
      }
      return toError(await client.from('class_blocks').upsert(classBlockToRow(entry.payload as ClassBlock)))
    },

    subscribe: (userId, handlers) => {
      const channel = client.channel(`daybook:${userId}`)
      for (const table of Object.keys(TABLE_ENTITY) as (keyof typeof TABLE_ENTITY)[]) {
        const entity = TABLE_ENTITY[table]
        const onEvent = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === 'DELETE') {
            // Only primary keys arrive for deletes; unknown ids are ignored by the engine.
            const id = payload.old.id
            if (typeof id === 'string') handlers.onDelete(entity, id)
            return
          }
          const row = payload.new
          if (typeof row.id !== 'string') return
          const record =
            entity === 'category'
              ? rowToCategory(row as Tables<'categories'>)
              : entity === 'classBlock'
                ? rowToClassBlock(row as Tables<'class_blocks'>)
                : null
          handlers.onChange(entity, row.id, record)
        }
        const filter = `user_id=eq.${userId}`
        channel
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, onEvent)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, onEvent)
          // Delete events can't be filtered; RLS still limits them to rows this user could see.
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, onEvent)
      }
      channel.subscribe()
      return () => {
        void client.removeChannel(channel)
      }
    },

    refreshSession: async () => {
      const { error } = await client.auth.refreshSession()
      return error === null
    },
  }
}
