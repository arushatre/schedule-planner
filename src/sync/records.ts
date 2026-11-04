import { withUuidIds } from '@/lib/backup'
import type { BackupData } from '@/lib/backup'
import type { Category } from '@/types/model'

// Pure helpers shared by the web sync engine and the phone app (mobile-app/src/outbox.ts), so this
// module must not import Dexie, zustand or anything browser-only.

/** Key-order-independent comparison so identical records don't trigger re-renders. */
export function sameRecord(a: unknown, b: unknown): boolean {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable)
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([x], [y]) => (x < y ? -1 : 1))
          .map(([key, inner]) => [key, stable(inner)]),
      )
    }
    return value
  }
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b))
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
