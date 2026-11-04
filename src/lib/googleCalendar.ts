import { addDays, addHours, format, parse } from 'date-fns'
import { create } from 'zustand'

import type { ClassBlock, Task } from '@/types/model'
import { fromDateStr, toDateStr } from './dates'
import { description, rrule } from './ics'

// One-way push of dated tasks and class blocks into an app-owned "Daybook" Google calendar.
// The narrow scope only reaches calendars this app created, never the user's others.
const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'
const API = 'https://www.googleapis.com/calendar/v3'
const CALENDAR_KEY = 'daybook:gcal-calendar'
const DEVICE_KEY = 'daybook:device-id'
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export const googleClientId: string | null = import.meta.env.VITE_GOOGLE_CLIENT_ID || null

type EventTime = { date: string } | { dateTime: string; timeZone: string }

export interface GoogleEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: EventTime
  end: EventTime
  recurrence?: string[]
}

/** Google event ids allow only 0-9 and a-v; a dashless UUID qualifies. */
const eventId = (prefix: string, uuid: string, suffix = '') => `${prefix}${uuid.replace(/-/g, '').toLowerCase()}${suffix}`

const localDateTime = (date: string, time: string) => parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date())
const isoLocal = (value: Date) => format(value, "yyyy-MM-dd'T'HH:mm:ss")

function timing(date: string, time: string | null, timeZone: string, endTime?: string): Pick<GoogleEvent, 'start' | 'end'> {
  if (!time) return { start: { date }, end: { date: toDateStr(addDays(fromDateStr(date), 1)) } }
  const start = localDateTime(date, time)
  const end = endTime ? localDateTime(date, endTime) : addHours(start, 1)
  return { start: { dateTime: isoLocal(start), timeZone }, end: { dateTime: isoLocal(end), timeZone } }
}

/** EXDATE must match DTSTART's type (all-day vs timed) or Google ignores it. */
function exdate(original: string, time: string | null, timeZone: string): string {
  if (!time) return `EXDATE;VALUE=DATE:${original.replace(/-/g, '')}`
  return `EXDATE;TZID=${timeZone}:${format(localDateTime(original, time), "yyyyMMdd'T'HHmmss")}`
}

/** With a TZID start, RFC 5545 needs UNTIL in UTC: the end of the local `until` day. */
function googleRrule(task: Task): string | null {
  const rule = rrule(task)
  if (!rule || !task.dueTime || !task.recurrence.until) return rule
  const endOfDay = parse(`${task.recurrence.until} 23:59:59`, 'yyyy-MM-dd HH:mm:ss', new Date())
  const utc = endOfDay.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return rule.replace(/UNTIL=[^;]+/, `UNTIL=${utc}`)
}

/** Everything that should exist in the Daybook calendar, keyed by stable ids. */
export function toGoogleEvents(tasks: Task[], classBlocks: ClassBlock[], timeZone: string, now = new Date()): GoogleEvent[] {
  const events: GoogleEvent[] = []
  for (const task of tasks) {
    if (!task.dueDate) continue
    const text = description(task)
    const base = { summary: task.title, ...(text ? { description: text } : {}) }
    const moved = Object.entries(task.exceptions)
    const rule = googleRrule(task)
    const recurrence = rule ? [`RRULE:${rule}`, ...moved.map(([original]) => exdate(original, task.dueTime, timeZone))] : []
    events.push({
      id: eventId('t', task.id),
      ...base,
      ...timing(task.dueDate, task.dueTime, timeZone),
      ...(recurrence.length ? { recurrence } : {}),
    })
    for (const [original, target] of moved) {
      events.push({ id: eventId('t', task.id, `m${original.replace(/-/g, '')}`), ...base, ...timing(target, task.dueTime, timeZone) })
    }
  }
  for (const block of classBlocks) {
    if (block.weekdays.length === 0) continue
    // The first occurrence must itself fall on one of the block's weekdays.
    let start = fromDateStr(toDateStr(now))
    while (!block.weekdays.includes(start.getDay())) start = addDays(start, 1)
    events.push({
      id: eventId('c', block.id),
      summary: block.title,
      ...(block.location ? { location: block.location } : {}),
      ...timing(toDateStr(start), block.startTime, timeZone, block.endTime),
      recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${block.weekdays.map((day) => BYDAY[day]).join(',')}`],
    })
  }
  return events
}

// ---------------------------------------------------------------------------
// Google Identity Services (browser token flow; no refresh token, ~1h access tokens)
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: TokenResponse) => void
            error_callback?: (error: { type: string; message?: string }) => void
          }) => TokenClient
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

let gisLoading: Promise<void> | null = null

function loadGis(): Promise<void> {
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      gisLoading = null
      reject(new Error('Couldn’t load Google sign-in. Check your connection.'))
    }
    document.head.appendChild(script)
  })
  return gisLoading
}

let token: { value: string; expiresAt: number } | null = null

export const hasFreshToken = () => token !== null && token.expiresAt - Date.now() > 60_000

/** Opens Google's consent popup the first time; must run from a click so it isn't blocked. */
async function requestToken(): Promise<string> {
  if (!googleClientId) throw new Error('Google Calendar isn’t set up: VITE_GOOGLE_CLIENT_ID is missing.')
  await loadGis()
  const oauth = window.google?.accounts.oauth2
  if (!oauth) throw new Error('Google sign-in didn’t load.')
  const value = await new Promise<string>((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: googleClientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.access_token) {
          token = { value: response.access_token, expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000 }
          resolve(response.access_token)
        } else reject(new Error(response.error ?? 'Google didn’t grant access.'))
      },
      error_callback: (error) => reject(new Error(error.type === 'popup_closed' ? 'The Google window was closed.' : (error.message ?? error.type))),
    })
    client.requestAccessToken({ prompt: '' })
  })
  return value
}

// ---------------------------------------------------------------------------
// Calendar API
// ---------------------------------------------------------------------------

class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function api<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new ApiError(body?.error?.message ?? `Google Calendar error ${response.status}`, response.status)
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

async function ensureCalendar(accessToken: string, timeZone: string): Promise<string> {
  const saved = localStorage.getItem(CALENDAR_KEY)
  if (saved) {
    try {
      await api(accessToken, `/calendars/${encodeURIComponent(saved)}`)
      return saved
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error
    }
  }
  const created = await api<{ id: string }>(accessToken, '/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: 'Daybook', description: 'Tasks and classes from Daybook.', timeZone }),
  })
  localStorage.setItem(CALENDAR_KEY, created.id)
  return created.id
}

interface RemoteEvent {
  id: string
  status: string
  extendedProperties?: { private?: Record<string, string> }
}

/** Every event this device pushed, including cancelled ones (their ids stay reserved). */
async function listOwnEvents(accessToken: string, calendar: string, device: string): Promise<Map<string, RemoteEvent>> {
  const found = new Map<string, RemoteEvent>()
  let pageToken = ''
  do {
    const query = new URLSearchParams({
      maxResults: '2500',
      showDeleted: 'true',
      privateExtendedProperty: `daybookDevice=${device}`,
      fields: 'items(id,status,extendedProperties),nextPageToken',
    })
    if (pageToken) query.set('pageToken', pageToken)
    const page = await api<{ items?: RemoteEvent[]; nextPageToken?: string }>(
      accessToken,
      `/calendars/${encodeURIComponent(calendar)}/events?${query}`,
    )
    for (const item of page.items ?? []) found.set(item.id, item)
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)
  return found
}

async function inPool<T>(items: T[], size: number, run: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await run(item)
  }
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, worker))
}

/**
 * Makes the calendar match `events`. Google is the record of what was pushed: each event carries
 * a hash of its content, so unchanged ones are skipped. Only this device's events are ever deleted,
 * so a second device syncing its own (separate) data can't wipe them.
 */
async function pushEvents(accessToken: string, events: GoogleEvent[], timeZone: string): Promise<number> {
  const calendar = await ensureCalendar(accessToken, timeZone)
  const device = deviceId()
  const remote = await listOwnEvents(accessToken, calendar, device)
  const base = `/calendars/${encodeURIComponent(calendar)}/events`
  const wanted = new Set(events.map((event) => event.id))

  await inPool(events, 4, async (event) => {
    const hash = JSON.stringify(event)
    const existing = remote.get(event.id)
    if (existing && existing.status !== 'cancelled' && existing.extendedProperties?.private?.daybookHash === hash) return
    const body = JSON.stringify({
      ...event,
      status: 'confirmed',
      extendedProperties: { private: { daybookDevice: device, daybookHash: hash } },
    })
    if (existing) {
      await api(accessToken, `${base}/${event.id}`, { method: 'PUT', body })
      return
    }
    try {
      await api(accessToken, base, { method: 'POST', body })
    } catch (error) {
      // 409: the id is taken (a deleted event's tombstone, or another device pushed it): update it instead.
      if (!(error instanceof ApiError) || error.status !== 409) throw error
      await api(accessToken, `${base}/${event.id}`, { method: 'PUT', body })
    }
  })

  const stale = [...remote.values()].filter((event) => event.status !== 'cancelled' && !wanted.has(event.id))
  await inPool(stale, 4, async (event) => {
    try {
      await api(accessToken, `${base}/${event.id}`, { method: 'DELETE' })
    } catch (error) {
      if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 410)) throw error
    }
  })
  return events.length
}

// ---------------------------------------------------------------------------
// Status store + actions used by the settings panel
// ---------------------------------------------------------------------------

interface GoogleCalendarState {
  connected: boolean
  syncing: boolean
  lastSyncedAt: number | null
  eventCount: number
  error: string | null
}

export const useGoogleCalendar = create<GoogleCalendarState>(() => ({
  connected: typeof localStorage !== 'undefined' && localStorage.getItem(CALENDAR_KEY) !== null,
  syncing: false,
  lastSyncedAt: null,
  eventCount: 0,
  error: null,
}))

let running: Promise<void> | null = null

/**
 * Pushes the current data. `interactive` (from a click) may open Google's popup for a new token;
 * background syncs only run while the last token is still valid.
 */
export function syncGoogleCalendar(tasks: Task[], classBlocks: ClassBlock[], interactive: boolean): Promise<void> {
  if (running) return running
  if (!interactive && !hasFreshToken()) return Promise.resolve()
  running = (async () => {
    useGoogleCalendar.setState({ syncing: true, error: null })
    try {
      const accessToken = hasFreshToken() && token ? token.value : await requestToken()
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const eventCount = await pushEvents(accessToken, toGoogleEvents(tasks, classBlocks, timeZone), timeZone)
      useGoogleCalendar.setState({ connected: true, eventCount, lastSyncedAt: Date.now() })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) token = null
      useGoogleCalendar.setState({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      useGoogleCalendar.setState({ syncing: false })
      running = null
    }
  })()
  return running
}

/** Stops syncing from this device. The Daybook calendar stays in Google until the user removes it. */
export function disconnectGoogleCalendar(): void {
  if (token) window.google?.accounts.oauth2.revoke(token.value)
  token = null
  localStorage.removeItem(CALENDAR_KEY)
  useGoogleCalendar.setState({ connected: false, lastSyncedAt: null, eventCount: 0, error: null })
}
