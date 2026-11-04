import Storage from 'expo-sqlite/kv-store'

import { DEFAULT_APPEARANCE, parseAppearance } from '@/lib/appearance'
import type { Appearance } from '@/lib/appearance'
import { parseBackup, serializeBackup } from '@/lib/backup'
import type { BackupData } from '@/lib/backup'
import type { OutboxEntry } from './outbox'

/*
 * Everything this phone keeps in expo-sqlite's key-value store. Writes are synchronous, so a
 * change survives the app being killed right after it.
 */

export type Mode = 'system' | 'light' | 'dark'

export interface Prefs {
  appearance: Appearance
  mode: Mode
  notifications: boolean
  briefing: boolean
}

export const DEFAULT_PREFS: Prefs = { appearance: DEFAULT_APPEARANCE, mode: 'system', notifications: false, briefing: true }

const PREFS_KEY = 'daybook:prefs'
/** Data saved by the app before accounts; offered for import, never deleted. */
const LEGACY_KEY = 'daybook:data'
const LEGACY_IMPORTED_KEY = 'daybook:data:importedTo'
/** Per-user cache: data, outbox and first-pull marker in one value, so they are written atomically. */
const userKey = (userId: string) => `daybook:user:${userId}`

export interface Saved {
  data: BackupData
  outbox: OutboxEntry[]
  pulledAt: number | null
}

interface Stored {
  data: string
  outbox: OutboxEntry[]
  pulledAt: number | null
}

export function readSaved(userId: string): Saved {
  const raw = Storage.getItemSync(userKey(userId))
  if (!raw) return { data: { tasks: [], categories: [], classBlocks: [] }, outbox: [], pulledAt: null }
  try {
    const stored = JSON.parse(raw) as Stored
    if (!Array.isArray(stored.outbox)) throw new Error('Missing outbox')
    return { data: parseBackup(stored.data), outbox: stored.outbox, pulledAt: stored.pulledAt }
  } catch (error) {
    // Unreadable cache: keep a copy rather than overwrite it, and rebuild from the server.
    console.warn('Daybook: unreadable local cache, re-downloading', error)
    Storage.setItemSync(`${userKey(userId)}:corrupt:${Date.now()}`, raw)
    return { data: { tasks: [], categories: [], classBlocks: [] }, outbox: [], pulledAt: null }
  }
}

export function writeSaved(userId: string, local: { data: BackupData; outbox: OutboxEntry[] }, pulledAt: number | null): void {
  const stored: Stored = { data: serializeBackup(local.data), outbox: local.outbox, pulledAt }
  Storage.setItemSync(userKey(userId), JSON.stringify(stored))
}

/** Tasks saved by the app before accounts, unless already imported; null when there are none. */
export function readLegacy(): BackupData | null {
  if (Storage.getItemSync(LEGACY_IMPORTED_KEY)) return null
  const raw = Storage.getItemSync(LEGACY_KEY)
  if (!raw) return null
  try {
    const data = parseBackup(raw)
    // The old app always seeded categories, so only tasks or classes count as real data.
    return data.tasks.length > 0 || data.classBlocks.length > 0 ? data : null
  } catch (error) {
    console.warn('Daybook: could not read data saved before accounts', error)
    return null
  }
}

/** No account on this phone is offered the pre-accounts data again. */
export const markLegacyImported = (userId: string): void => Storage.setItemSync(LEGACY_IMPORTED_KEY, userId)

export function loadPrefs(): Prefs {
  try {
    const parsed = JSON.parse(Storage.getItemSync(PREFS_KEY) ?? '{}') as Partial<Prefs>
    return {
      appearance: parseAppearance(JSON.stringify(parsed.appearance ?? {})),
      mode: parsed.mode === 'light' || parsed.mode === 'dark' ? parsed.mode : 'system',
      notifications: parsed.notifications === true,
      briefing: parsed.briefing !== false,
    }
  } catch (error) {
    console.warn('Daybook: unreadable preferences, using defaults', error)
    return DEFAULT_PREFS
  }
}

export const savePrefs = (prefs: Prefs): void => Storage.setItemSync(PREFS_KEY, JSON.stringify(prefs))
