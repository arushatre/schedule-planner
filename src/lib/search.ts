import Fuse from 'fuse.js'

import type { Task } from '@/types/model'
import { formatTime } from './dates'

/** True when the label, or any word in it, starts with the query, ignoring case ("11" → "11:30 AM", "wor" → "Work"). */
export function matchesQuery(label: string, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const hay = label.toLowerCase()
  return hay.startsWith(needle) || hay.split(/[\s·\-–]+/).some((word) => word.startsWith(needle))
}

/** Ids of tasks whose title, notes or tags fuzzy-match the query, or whose due time starts with it ("11" → 11:30 AM). */
export function searchTaskIds(tasks: Task[], query: string): Set<string> {
  const trimmed = query.trim()
  if (!trimmed) return new Set(tasks.map((task) => task.id))
  const fuse = new Fuse(tasks, {
    keys: ['title', 'notes', 'tags'],
    threshold: 0.35,
    ignoreLocation: true,
  })
  const ids = new Set(fuse.search(trimmed).map((result) => result.item.id))
  if (/^\d/.test(trimmed)) {
    for (const task of tasks) if (task.dueTime && matchesQuery(formatTime(task.dueTime), trimmed)) ids.add(task.id)
  }
  return ids
}
