import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeTask } from '@/lib/tasks'
import { FakeRemote, NETWORK_ERROR, RLS_ERROR } from '@/test/fakeRemote'
import type { Category, Task } from '@/types/model'
import { CacheDb } from './cache'
import { SyncEngine } from './engine'
import type { Patch, SyncStatus } from './engine'
import type { RemoteError } from './remote'

interface Harness {
  engine: SyncEngine
  cache: CacheDb
  remote: FakeRemote
  patches: Patch[]
  statuses: SyncStatus[]
  rejected: RemoteError[]
  setOnline: (online: boolean) => void
}

const running: Harness[] = []

function setup({ online = true, remote = new FakeRemote() } = {}): Harness {
  let isOnline = online
  const userId = crypto.randomUUID()
  const cache = new CacheDb(userId)
  const patches: Patch[] = []
  const statuses: SyncStatus[] = []
  const rejected: RemoteError[] = []
  const engine = new SyncEngine({
    userId,
    cache,
    remote,
    isOnline: () => isOnline,
    onPatch: (patch) => patches.push(patch),
    onStatus: (status) => statuses.push(status),
    onRejected: (_entity, error) => rejected.push(error),
  })
  const harness = { engine, cache, remote, patches, statuses, rejected, setOnline: (next: boolean) => (isOnline = next) }
  running.push(harness)
  return harness
}

afterEach(async () => {
  for (const { engine, cache } of running.splice(0)) {
    engine.stop()
    cache.close()
    await cache.delete()
  }
})

const task = (title: string, extra: Partial<Task> = {}): Task => makeTask({ title, categoryId: '', ...extra })
const none = () => null

describe('SyncEngine outbox', () => {
  it('coalesces repeated edits to one record into a single pending write', async () => {
    const { engine, cache } = setup({ online: false })
    const draft = task('Essay')
    await engine.save('task', [draft], none)
    await engine.save('task', [{ ...draft, title: 'Essay v2' }], () => draft)
    await engine.save('task', [{ ...draft, title: 'Essay v3' }], () => draft)

    const entries = await cache.outbox.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ op: 'upsert', payload: { title: 'Essay v3' }, before: null, rev: 2 })
  })

  it('queues writes while offline and replays them in order when the browser comes back online', async () => {
    const { engine, cache, remote, setOnline } = setup({ online: false })
    await engine.start()
    const category: Category = { id: crypto.randomUUID(), name: 'Math', colorKey: 'slate', archived: false, order: 0, createdAt: 1 }
    await engine.save('category', [category], none)
    await engine.save('task', [task('Problem set', { categoryId: category.id })], none)
    expect(remote.sent).toHaveLength(0)
    expect(await cache.outbox.count()).toBe(2)

    setOnline(true)
    window.dispatchEvent(new Event('online'))

    await vi.waitFor(async () => expect(await cache.outbox.count()).toBe(0))
    // The category must reach the server before the task that references it.
    expect(remote.sent.map((entry) => entry.entity)).toEqual(['category', 'task'])
  })

  it('keeps the write and retries after a transient failure', async () => {
    const { engine, cache, remote, statuses } = setup()
    remote.failNext(NETWORK_ERROR)
    // save() starts a background flush; wait for it to hit the failure.
    await engine.save('task', [task('Retry me')], none)
    await vi.waitFor(() => expect(statuses.at(-1)?.state).toBe('offline'))

    expect(await cache.outbox.count()).toBe(1)
    expect((await cache.outbox.toArray())[0]?.attempts).toBe(1)
    expect(statuses.at(-1)?.state).toBe('offline')

    await engine.flush()
    expect(await cache.outbox.count()).toBe(0)
    expect(remote.sent).toHaveLength(1)
  })

  it('rolls back to the last server-confirmed state when the server rejects an edit', async () => {
    const original = task('Original')
    const remote = new FakeRemote()
    remote.seed({ tasks: [original] })
    const { engine, cache, patches, rejected } = setup({ remote })
    await engine.pull()

    remote.failNext(RLS_ERROR)
    await engine.save('task', [{ ...original, title: 'Rejected edit' }], () => original)
    await engine.flush()

    expect((await cache.tasks.get(original.id))?.title).toBe('Original')
    expect(await cache.outbox.count()).toBe(0)
    expect(rejected).toEqual([RLS_ERROR])
    expect(patches.at(-1)?.task.put.map((t) => t.title)).toEqual(['Original'])
  })

  it('removes a rejected new record instead of leaving a ghost', async () => {
    const { engine, cache, remote, patches } = setup()
    const draft = task('Never saved')
    remote.failNext(RLS_ERROR)
    await engine.save('task', [draft], none)
    await engine.flush()

    expect(await cache.tasks.get(draft.id)).toBeUndefined()
    expect(patches.at(-1)?.task.remove).toEqual([draft.id])
  })

  it('keeps an edit made while the previous save was in flight', async () => {
    const { engine, cache, remote } = setup()
    const draft = task('v1')
    let release: () => void = () => undefined
    const send = remote.send
    remote.send = async (entry) => {
      await new Promise<void>((resolve) => (release = resolve))
      return send(entry)
    }
    await engine.save('task', [draft], none)
    await vi.waitFor(() => expect(release).not.toBe(undefined))
    await engine.save('task', [{ ...draft, title: 'v2' }], () => draft)
    release()

    await vi.waitFor(async () => expect(await cache.outbox.count()).toBe(1))
    expect((await cache.outbox.toArray())[0]).toMatchObject({ payload: { title: 'v2' }, before: { title: 'v1' } })
  })
})

describe('SyncEngine pull and realtime', () => {
  it('replaces cached records with the server copy but never overwrites pending local edits', async () => {
    const mine = task('Mine')
    const theirs = task('From another device')
    const gone = task('Deleted elsewhere')
    const remote = new FakeRemote()
    remote.seed({ tasks: [mine, gone] })
    const { engine, cache, setOnline } = setup({ remote })
    await engine.pull()

    setOnline(false)
    await engine.save('task', [{ ...mine, title: 'Mine, edited offline' }], () => mine)
    remote.rows.task.set(mine.id, { ...mine, title: 'Server version' })
    remote.rows.task.set(theirs.id, theirs)
    remote.rows.task.delete(gone.id)

    await engine.pull()
    const cached = await cache.tasks.toArray()
    expect(cached.map((t) => t.title).sort()).toEqual(['From another device', 'Mine, edited offline'])
    expect(await engine.hasPulled()).toBe(true)
  })

  it('applies realtime deletes and refetches changed tasks, skipping pending ones', async () => {
    const a = task('A')
    const b = task('B')
    const remote = new FakeRemote()
    remote.seed({ tasks: [a, b] })
    const { engine, cache, setOnline } = setup({ remote })
    await engine.start()

    remote.handlers?.onDelete('task', a.id)
    await vi.waitFor(async () => expect(await cache.tasks.get(a.id)).toBeUndefined())

    setOnline(false)
    await engine.save('task', [{ ...b, title: 'B local' }], () => b)
    remote.rows.task.set(b.id, { ...b, title: 'B remote' })
    remote.handlers?.onChange('task', b.id, null)
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect((await cache.tasks.get(b.id))?.title).toBe('B local')
  })
})
