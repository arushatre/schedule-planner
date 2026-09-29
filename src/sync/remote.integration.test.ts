// @vitest-environment node
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { makeTask } from '@/lib/tasks'
import type { Database } from '@/types/database'
import type { Category, Task } from '@/types/model'
import type { OutboxEntry } from './cache'
import { classifyError, createSupabaseRemote } from './remote'

// Runs against the local Supabase stack: `npm run db:start && npm run test:integration`.
const enabled = import.meta.env.VITE_SUPABASE_INTEGRATION === '1'
const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

async function signUp() {
  const client = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signUp({ email: `it-${crypto.randomUUID()}@daybook.test`, password: 'correct-horse-9' })
  if (error || !data.user) throw new Error(`sign-up failed: ${error?.message}`)
  return { client, userId: data.user.id, remote: createSupabaseRemote(client) }
}

const upsert = (entity: OutboxEntry['entity'], payload: OutboxEntry['payload']): OutboxEntry => ({
  entity,
  id: payload?.id ?? '',
  op: 'upsert',
  payload,
  before: null,
  rev: 0,
  attempts: 0,
  createdAt: Date.now(),
})

describe.skipIf(!enabled)('Supabase remote (integration)', () => {
  it('saves and reads back a full task aggregate, isolated per user', async () => {
    const a = await signUp()
    const b = await signUp()

    const category: Category = { id: crypto.randomUUID(), name: 'School', colorKey: 'slate', archived: false, order: 0, createdAt: Date.now() }
    const task: Task = makeTask({
      title: 'Essay draft',
      categoryId: category.id,
      dueDate: '2026-10-02',
      dueTime: '17:00',
      tags: ['english', 'School'],
      priority: 'urgent',
      subtasks: [
        { id: crypto.randomUUID(), title: 'Outline', done: true },
        { id: crypto.randomUUID(), title: 'Write', done: false },
      ],
      recurrence: { kind: 'weekly', weekdays: [], until: null },
      completedDates: ['2026-10-09'],
      exceptions: { '2026-10-16': '2026-10-17' },
      reminderTime: '16:30',
    })

    expect(await a.remote.send(upsert('category', category))).toBeNull()
    expect(await a.remote.send(upsert('task', task))).toBeNull()

    const mine = await a.remote.fetchAll()
    expect(mine.error).toBeNull()
    expect(mine.data?.categories).toEqual([category])
    const [saved] = mine.data?.tasks ?? []
    expect({ ...saved, updatedAt: 0 }).toEqual({ ...task, tags: ['School', 'english'], updatedAt: 0 })

    // Editing removes a subtask and a tag; the RPC must drop them server-side.
    const edited: Task = { ...task, subtasks: task.subtasks.slice(1), tags: ['english'], completedDates: [], exceptions: {} }
    expect(await a.remote.send(upsert('task', edited))).toBeNull()
    const [reread] = (await a.remote.fetchTasks([task.id])).data ?? []
    expect(reread).toMatchObject({ subtasks: edited.subtasks, tags: ['english'], completedDates: [], exceptions: {} })

    // User B sees nothing and cannot overwrite A's task.
    const theirs = await b.remote.fetchAll()
    expect(theirs.data).toEqual({ tasks: [], categories: [], classBlocks: [] })
    const hijack = await b.remote.send(upsert('task', { ...task, title: 'hijacked', categoryId: '' }))
    expect(hijack && classifyError(hijack)).toBe('permanent')
    expect((await a.remote.fetchTasks([task.id])).data?.[0]?.title).toBe('Essay draft')

    // Deleting as B is a silent no-op; deleting as A cascades.
    expect(await b.remote.send({ ...upsert('task', null), id: task.id, op: 'delete' })).toBeNull()
    expect((await a.remote.fetchTasks([task.id])).data).toHaveLength(1)
    expect(await a.remote.send({ ...upsert('task', null), id: task.id, op: 'delete' })).toBeNull()
    expect((await a.remote.fetchTasks([task.id])).data).toHaveLength(0)
  })

  it('delivers realtime task changes to another session of the same user only', async () => {
    const a = await signUp()
    const other = await signUp()
    const { data } = await a.client.auth.getSession()
    const second = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    await second.auth.setSession({
      access_token: data.session?.access_token ?? '',
      refresh_token: data.session?.refresh_token ?? '',
    })

    const seen: string[] = []
    const strangers: string[] = []
    const stop = a.remote.subscribe(a.userId, { onChange: (_entity, id) => seen.push(id), onDelete: () => undefined })
    const stopOther = other.remote.subscribe(other.userId, {
      onChange: (_entity, id) => strangers.push(id),
      onDelete: () => undefined,
    })
    // Changes written before the channels finish joining are never delivered.
    const joined = () => [a.client, other.client].every((client) => client.getChannels().every((ch) => ch.state === 'joined'))
    await expect.poll(joined, { timeout: 8000, interval: 100 }).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    const task = makeTask({ title: 'From tab 2', categoryId: '' })
    expect(await createSupabaseRemote(second).send(upsert('task', task))).toBeNull()

    await expect.poll(() => seen, { timeout: 8000, interval: 200 }).toContain(task.id)
    expect(strangers).not.toContain(task.id)
    stop()
    stopOther()
  }, 15000)
})
