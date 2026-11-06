import Fuse from 'fuse.js'

import type { Task } from '@/types/model'

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
