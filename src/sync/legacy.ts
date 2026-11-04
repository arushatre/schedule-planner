import Dexie from 'dexie'
import { create } from 'zustand'

import { DaybookDb } from '@/db/schema'
import { parseBackup, serializeBackup } from '@/lib/backup'
import type { BackupData } from '@/lib/backup'
import { CacheDb } from './cache'

/** Name of the pre-accounts IndexedDB database (see src/db/schema.ts). */
const LEGACY_DB = 'daybook'
const IMPORTED_KEY = 'importedTo'

/** Profile id of the accountless cache (`daybook:local`) used while the app ran without sign-in. */
export const LOCAL_USER_ID = 'local'
const LOCAL_DB = `daybook:${LOCAL_USER_ID}`

/** Per-account cache flag: the user already answered the import offer (either way). */
export const LEGACY_ANSWERED_KEY = 'legacyImportAnswered'

/** The tables both local databases share. */
type LocalStore = Pick<DaybookDb, 'tasks' | 'categories' | 'classBlocks' | 'meta' | 'close'>

const SOURCES: { name: string; open: () => LocalStore }[] = [
  { name: LEGACY_DB, open: () => new DaybookDb(LEGACY_DB) },
  { name: LOCAL_DB, open: () => new CacheDb(LOCAL_USER_ID) },
]

async function readSource({ name, open }: (typeof SOURCES)[number]): Promise<BackupData | null> {
  // Opening a database that doesn't exist would create it, so check first.
  if (!(await Dexie.exists(name))) return null
  const db = open()
  try {
    if (await db.meta.get(IMPORTED_KEY)) return null
    const [tasks, categories, classBlocks] = await Promise.all([
      db.tasks.toArray(),
      db.categories.toArray(),
      db.classBlocks.toArray(),
    ])
    return { tasks, categories, classBlocks }
  } finally {
    db.close()
  }
}

/** Later sources win on id clashes: the local cache is newer than the legacy database. */
const byId = <T extends { id: string }>(rows: T[]): T[] => [...new Map(rows.map((row) => [row.id, row])).values()]

/**
 * Reads tasks saved in this browser without an account: the pre-accounts `daybook` database and
 * the accountless `daybook:local` cache, merged. Null when there is nothing to offer.
 */
export async function readLegacyData(): Promise<BackupData | null> {
  const sources = (await Promise.all(SOURCES.map(readSource))).filter((data): data is BackupData => data !== null)
  const tasks = byId(sources.flatMap((data) => data.tasks))
  const classBlocks = byId(sources.flatMap((data) => data.classBlocks))
  if (tasks.length === 0 && classBlocks.length === 0) return null
  const categories = byId(sources.flatMap((data) => data.categories))
  // Round-trip through the backup parser so old rows get the same validation as an imported file.
  return parseBackup(serializeBackup({ tasks, categories, classBlocks }))
}

/** Marks local data as imported so no other account on this browser is offered it again. */
export async function markLegacyImported(userId: string): Promise<void> {
  for (const source of SOURCES) {
    if (!(await Dexie.exists(source.name))) continue
    const db = source.open()
    try {
      await db.meta.put({ key: IMPORTED_KEY, value: userId })
    } finally {
      db.close()
    }
  }
}

/** Pending "import tasks from this device?" offer, shown by ImportLocalDialog. */
export const useLegacyImport = create<{ offer: BackupData | null }>()(() => ({ offer: null }))
