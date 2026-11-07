import Fuse from 'fuse.js'

import type { Task } from '@/types/model'

/** True when the label, or any word in it, starts with the query, ignoring case ("11" → "11:30 AM", "wor" → "Work"). */
export function matchesQuery(label: string, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const hay = label.toLowerCase()
  return hay.startsWith(needle) || hay.split(/[\s·\-–]+/).some((word) => word.startsWith(needle))
}

/** Ids of tasks whose title, notes or tags fuzzy-match the query. */
export function searchTaskIds(tasks: Task[], query: string): Set<string> {
  const trimmed = query.trim()
  if (!trimmed) return new Set(tasks.map((task) => task.id))
  const fuse = new Fuse(tasks, {
    keys: ['title', 'notes', 'tags'],
    threshold: 0.35,
    ignoreLocation: true,
  })
  return new Set(fuse.search(trimmed).map((result) => result.item.id))
}
