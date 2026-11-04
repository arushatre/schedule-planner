import { ACTIVITY_THROTTLE_MS } from '@/lib/activity'
import type { ActivityEvent } from '@/lib/activity'
import type { SupabaseClient } from '@/lib/supabase'

// Logs "the user did something" for the streak history, shared by the web and phone apps.
// Deliberately outside the task outbox: events are insert-only with client ids, so a retry is
// harmless and two devices never conflict. Never throws: a failed send stays queued for next time.
// shortcut: activity history is not in JSON backups; add it to src/lib/backup.ts if that matters.

/** Synchronous key-value storage (localStorage on web, expo-sqlite kv on the phone). */
export interface KeyValue {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface ActivityTracker {
  /** Called on every add / edit / check / delete; throttled to one event per few minutes. */
  record: (kind: string) => void
  /** Sends queued events and fetches the latest history from the server. */
  refresh: () => Promise<void>
  events: () => ActivityEvent[]
  subscribe: (listener: () => void) => () => void
}

interface Saved {
  events: ActivityEvent[]
  /** Ids not yet confirmed by the server. */
  pending: string[]
}

/** Bounds local storage even if the server stays unreachable (e.g. before the migration is pushed). */
const MAX_EVENTS = 5000
const HISTORY_DAYS = 400

export function createActivityTracker(userId: string, client: SupabaseClient, storage: KeyValue): ActivityTracker {
  // Keyed per account, so one user's queued events never flush into another's session.
  const key = `daybook:activity:${userId}`
  const listeners = new Set<() => void>()
  let saved: Saved = { events: [], pending: [] }
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? 'null') as Saved | null
    if (parsed && Array.isArray(parsed.events) && Array.isArray(parsed.pending)) saved = parsed
  } catch {
    // Unreadable: start fresh; the server copy comes back on the next refresh.
  }

  const save = (next: Saved) => {
    const events = [...next.events].sort((a, b) => a.at - b.at).slice(-MAX_EVENTS)
    const kept = new Set(events.map((event) => event.id))
    saved = { events, pending: next.pending.filter((id) => kept.has(id)) }
    storage.setItem(key, JSON.stringify(saved))
    listeners.forEach((listener) => listener())
  }

  let sending: Promise<void> | null = null
  const send = (): Promise<void> => {
    if (sending) return sending
    sending = (async () => {
      const ids = new Set(saved.pending)
      if (ids.size === 0) return
      const rows = saved.events
        .filter((event) => ids.has(event.id))
        .map((event) => ({ id: event.id, at: new Date(event.at).toISOString(), kind: event.kind }))
      const { error } = await client.from('activity_events').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      if (error) return
      save({ ...saved, pending: saved.pending.filter((id) => !ids.has(id)) })
    })()
      .catch(() => undefined)
      .finally(() => {
        sending = null
      })
    return sending
  }

  return {
    record: (kind) => {
      const now = Date.now()
      const last = saved.events[saved.events.length - 1]
      if (last && now - last.at < ACTIVITY_THROTTLE_MS) return
      const event = { id: crypto.randomUUID(), at: now, kind }
      save({ events: [...saved.events, event], pending: [...saved.pending, event.id] })
      void send()
    },

    refresh: async () => {
      await send()
      try {
        const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString()
        const { data, error } = await client.from('activity_events').select('id, at, kind').gte('at', since).order('at')
        if (error) return
        const pending = new Set(saved.pending)
        const local = saved.events.filter((event) => pending.has(event.id))
        const server = data.map((row) => ({ id: row.id, at: new Date(row.at).getTime(), kind: row.kind }))
        save({ events: [...server, ...local.filter((event) => !server.some((row) => row.id === event.id))], pending: saved.pending })
      } catch {
        // Offline: keep what this device already has.
      }
    },

    events: () => saved.events,

    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
