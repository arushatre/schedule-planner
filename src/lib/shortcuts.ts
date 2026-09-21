export type ShortcutAction = 'new' | 'search' | 'edit' | 'help'

export interface KeyLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

export interface KeyContext {
  /** Focus is in a text field, so letters are input, not commands. */
  typing: boolean
  /** A dialog or editor is open. */
  modalOpen: boolean
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

const BY_KEY: Record<string, ShortcutAction> = { n: 'new', '/': 'search', e: 'edit', '?': 'help' }

/** Maps a key press to an app action, or null if it should be left alone. */
export function matchShortcut(event: KeyLike, context: KeyContext): ShortcutAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  if (context.typing || context.modalOpen) return null
  return BY_KEY[event.key.toLowerCase()] ?? null
}

export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'N', label: 'New task' },
  { keys: '/', label: 'Search tasks' },
  { keys: 'E', label: 'Edit the task under the pointer or with focus' },
  { keys: 'Esc', label: 'Close a dialog or cancel a drag' },
  { keys: '?', label: 'Show this help' },
  { keys: 'Space', label: 'Pick up a calendar chip; arrow keys move it, Space drops' },
]
