import Dexie from 'dexie'
import { create } from 'zustand'

import { DaybookDb } from '@/db/schema'
import { parseBackup, serializeBackup, withUuidIds } from '@/lib/backup'
import type { BackupData } from '@/lib/backup'
import type { Category } from '@/types/model'

/** Name of the pre-accounts IndexedDB database (see src/db/schema.ts). */
const LEGACY_DB = 'daybook'
const IMPORTED_KEY = 'importedTo'

/** Per-account cache flag: the user already answered the import offer (either way). */
export const LEGACY_ANSWERED_KEY = 'legacyImportAnswered'

/** Reads tasks saved in this browser before accounts existed; null when there are none. */
export async function readLegacyData(): Promise<BackupData | null> {
  if (!(await Dexie.exists(LEGACY_DB))) return null
  const db = new DaybookDb(LEGACY_DB)
  try {
    if (await db.meta.get(IMPORTED_KEY)) return null
    const [tasks, categories, classBlocks] = await Promise.all([
      db.tasks.toArray(),
      db.categories.toArray(),
      db.classBlocks.toArray(),
    ])
    if (tasks.length === 0 && classBlocks.length === 0) return null
    // Round-trip through the backup parser so old rows get the same validation as an imported file.
    return parseBackup(serializeBackup({ tasks, categories, classBlocks }))
  } finally {
    db.close()
  }
}

/** Marks the legacy data as imported so no other account on this browser is offered it again. */
export async function markLegacyImported(userId: string): Promise<void> {
  const db = new DaybookDb(LEGACY_DB)
  try {
    await db.meta.put({ key: IMPORTED_KEY, value: userId })
  } finally {
    db.close()
  }
}

/**
 * Prepares legacy data for an account: ids become UUIDs, and categories that match an existing
 * one by name (e.g. the seeded "School") are reused instead of duplicated.
 */
export function planLegacyImport(legacy: BackupData, existing: Category[]): BackupData {
  const data = withUuidIds(legacy)
  const byName = new Map(existing.map((category) => [category.name.trim().toLowerCase(), category.id]))
  const redirect = new Map<string, string>()
  const nextOrder = existing.reduce((max, category) => Math.max(max, category.order), -1) + 1
  // IndexedDB returns rows by primary key, so restore the user's own ordering first.
  const categories = [...data.categories].sort((a, b) => a.order - b.order).flatMap((category, index) => {
    const match = byName.get(category.name.trim().toLowerCase())
    if (match) {
      redirect.set(category.id, match)
      return []
    }
    return [{ ...category, order: nextOrder + index }]
  })
  return {
    categories,
    classBlocks: data.classBlocks,
    tasks: data.tasks.map((task) => ({ ...task, categoryId: redirect.get(task.categoryId) ?? task.categoryId })),
  }
}

/** Pending "import tasks from this device?" offer, shown by ImportLocalDialog. */
export const useLegacyImport = create<{ offer: BackupData | null }>()(() => ({ offer: null }))
