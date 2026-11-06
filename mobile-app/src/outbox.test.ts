import { describe, expect, it } from 'vitest'

import type { BackupData } from '@/lib/backup'
import type { Category, Task } from '@/types/model'
import { addAll, applyServer, confirm, enqueue, mergePull, reject, replaceAllWith } from './outbox'
import type { OutboxEntry, Write } from './outbox'

const task = (id: string, title = id, extra: Partial<Task> = {}): Task => ({
  id,
  title,
  notes: '',
  dueDate: null,
  dueTime: null,
  categoryId: '',
  tags: [],
  priority: 'medium',
  status: 'todo',
  subtasks: [],
  recurrence: { kind: 'none', weekdays: [], until: null },
  completedDates: [],
  exceptions: {},
  reminderTime: null,
  alerts: [],
  sortOrder: 0,
  focusDate: null,
  focusNote: '',
  completedAt: null,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
})

const category = (id: string, name: string, order = 0): Category => ({ id, name, colorKey: 'slate', archived: false, order, createdAt: 1 })

const data = (tasks: Task[], categories: Category[] = []): BackupData => ({ tasks, categories, classBlocks: [] })

const upsert = (record: Task, before: Task | null = null): Write => ({ entity: 'task', id: record.id, op: 'upsert', payload: record, before })

describe('enqueue', () => {
  it('appends new records in order with increasing seq', () => {
    const outbox = enqueue(enqueue([], upsert(task('a'))), upsert(task('b')))
    expect(outbox.map((entry) => [entry.id, entry.seq, entry.rev])).toEqual([
      ['a', 1, 0],
      ['b', 2, 0],
    ])
  })

  it('coalesces writes to one record, keeping its position and oldest before', () => {
    const original = task('a', 'server')
    let outbox = enqueue([], upsert(task('a', 'edit 1'), original))
    outbox = enqueue(outbox, upsert(task('b')))
    outbox = enqueue(outbox, upsert(task('a', 'edit 2'), task('a', 'edit 1')))
    expect(outbox).toHaveLength(2)
    expect(outbox[0]).toMatchObject({ id: 'a', seq: 1, rev: 1, before: original, payload: { title: 'edit 2' } })
  })

  it('turns a pending create into a delete rather than dropping it', () => {
    const outbox = enqueue(enqueue([], upsert(task('a'))), { entity: 'task', id: 'a', op: 'delete', payload: null, before: task('a') })
    expect(outbox).toEqual([expect.objectContaining({ op: 'delete', payload: null, before: null, rev: 1 })])
  })
})

describe('confirm', () => {
  it('removes the entry when it did not change in flight', () => {
    const outbox = enqueue([], upsert(task('a')))
    expect(confirm(outbox, outbox[0] as OutboxEntry)).toEqual([])
  })

  it('keeps a newer write, now based on what was just sent', () => {
    const sent = enqueue([], upsert(task('a', 'v1')))
    const outbox = enqueue(sent, upsert(task('a', 'v2')))
    const after = confirm(outbox, sent[0] as OutboxEntry)
    expect(after).toEqual([expect.objectContaining({ before: task('a', 'v1'), payload: task('a', 'v2'), attempts: 0 })])
  })
})

describe('reject', () => {
  it('restores the server state of an edited record', () => {
    const outbox = enqueue([], upsert(task('a', 'local'), task('a', 'server')))
    const result = reject(data([task('a', 'local'), task('b')]), outbox, outbox[0] as OutboxEntry)
    expect(result.outbox).toEqual([])
    expect(result.data.tasks.map((t) => t.title).sort()).toEqual(['b', 'server'])
  })

  it('removes a rejected create', () => {
    const outbox = enqueue([], upsert(task('a')))
    expect(reject(data([task('a')]), outbox, outbox[0] as OutboxEntry).data.tasks).toEqual([])
  })
})

describe('applyServer', () => {
  it('never overwrites or removes a record with a pending write', () => {
    const local = data([task('a', 'local'), task('b')])
    const outbox = enqueue([], upsert(task('a', 'local')))
    const next = applyServer(local, outbox, 'task', [task('a', 'remote')], ['a'])
    expect(next).toBe(local)
  })

  it('applies changes and deletes to other records', () => {
    const local = data([task('a'), task('b')])
    const next = applyServer(local, [], 'task', [task('a', 'renamed'), task('c')], ['b'])
    expect(next.tasks.map((t) => t.title)).toEqual(['renamed', 'c'])
  })

  it('returns the same object when nothing changed, whatever the key order', () => {
    const local = data([task('a')])
    const reordered = Object.fromEntries(Object.entries(task('a')).reverse()) as unknown as Task
    expect(applyServer(local, [], 'task', [reordered], ['missing'])).toBe(local)
  })
})

describe('mergePull', () => {
  it('takes the server snapshot but keeps pending creates, edits and deletes', () => {
    const local = data([task('created'), task('edited', 'local edit'), task('stale')])
    let outbox = enqueue([], upsert(task('created')))
    outbox = enqueue(outbox, upsert(task('edited', 'local edit')))
    outbox = enqueue(outbox, { entity: 'task', id: 'deleted', op: 'delete', payload: null, before: task('deleted') })
    const server = data([task('edited', 'server'), task('deleted'), task('new')], [category('c1', 'School')])
    const next = mergePull(local, outbox, server)
    expect(next.tasks.map((t) => `${t.id}:${t.title}`).sort()).toEqual(['created:created', 'edited:local edit', 'new:new'])
    expect(next.categories).toEqual([category('c1', 'School')])
  })

  it('keeps unchanged lists by reference so nothing re-renders', () => {
    const local = data([task('a')], [category('c1', 'School')])
    const next = mergePull(local, [], data([task('a', 'changed')], [category('c1', 'School')]))
    expect(next.categories).toBe(local.categories)
    expect(next.tasks).not.toBe(local.tasks)
  })
})

describe('addAll and replaceAllWith', () => {
  it('queues categories before the tasks that use them', () => {
    const change = addAll(data([task('old')]), data([task('t', 't', { categoryId: 'c' })], [category('c', 'Gym')]))
    expect(change.writes.map((write) => `${write.op}:${write.entity}:${write.id}`)).toEqual(['upsert:category:c', 'upsert:task:t'])
    expect(change.data.tasks.map((t) => t.id)).toEqual(['old', 't'])
  })

  it('replaces: upserts categories first, deletes tasks before categories, keeps befores', () => {
    const current = data([task('keep', 'old title'), task('gone')], [category('c-old', 'Old')])
    const next = data([task('keep', 'new title')], [category('c-new', 'New')])
    const change = replaceAllWith(current, next)
    expect(change.writes.map((write) => `${write.op}:${write.entity}:${write.id}`)).toEqual([
      'upsert:category:c-new',
      'upsert:task:keep',
      'delete:task:gone',
      'delete:category:c-old',
    ])
    expect(change.writes[1]?.before).toEqual(task('keep', 'old title'))
    expect(change.data).toBe(next)
  })
})
