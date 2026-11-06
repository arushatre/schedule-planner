import { Pencil, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Icon } from '@/components/ui/Icon'
import { useTaskActions } from '@/hooks/useTaskActions'
import { cx } from '@/lib/cx'
import { UNCATEGORIZED, categoryFor } from '@/lib/tasks'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import type { Occurrence, Task } from '@/types/model'

const iconButton =
  'rounded-md p-1 text-fg-subtle opacity-0 transition-colors hover:bg-sunken hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100'

function FocusItem({ occ, n }: { occ: Occurrence; n: number }) {
  const categories = useTasksStore((state) => state.categories)
  const openEditor = useUiStore((state) => state.openEditor)
  const { guard } = useTaskActions()
  const [draft, setDraft] = useState<string | null>(null)
  // Esc unmounts the textarea; this stops the blur that follows from saving anyway.
  const cancelled = useRef(false)
  const { task } = occ
  const category = categoryFor(task.categoryId, categories)

  // Saves on top of the store's latest copy, so a note saved on blur isn't undone by an unpin right after it.
  const update = (change: Partial<Task>) =>
    void guard(() => {
      const { tasks, saveTask } = useTasksStore.getState()
      const latest = tasks.find((existing) => existing.id === task.id) ?? task
      return saveTask({ ...latest, ...change })
    })

  const edit = () => {
    cancelled.current = false
    setDraft(task.focusNote)
  }
  const save = () => {
    if (draft === null || cancelled.current) return
    const note = draft.trim()
    setDraft(null)
    if (note !== task.focusNote) update({ focusNote: note })
  }

  return (
    <li
      onDoubleClick={edit}
      className="group rounded-md px-3 py-2"
      style={category === UNCATEGORIZED ? undefined : { background: `color-mix(in srgb, rgb(var(--cat-${category.colorKey})) var(--tint), rgb(var(--raised)))` }}
    >
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => openEditor({ mode: 'edit', taskId: task.id })} className="min-w-0 flex-1 text-left">
          <span className={cx('block truncate text-base', occ.done && 'text-fg-subtle line-through')}>
            <span className="tabular text-fg-muted">{n}.</span> {task.title}
          </span>
        </button>
        <button type="button" onClick={edit} aria-label={`Edit focus note for ${task.title}`} className={iconButton}>
          <Icon icon={Pencil} size={14} />
        </button>
        <button type="button" onClick={() => update({ focusDate: null })} aria-label={`Remove ${task.title} from focus`} className={iconButton}>
          <Icon icon={X} size={14} />
        </button>
      </div>
      {draft !== null ? (
        <textarea
          autoFocus
          value={draft}
          rows={2}
          maxLength={2000}
          placeholder="Add a note"
          aria-label={`Focus note for ${task.title}`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              save()
            } else if (event.key === 'Escape') {
              event.stopPropagation()
              cancelled.current = true
              setDraft(null)
            }
          }}
          className="mt-1 w-full resize-none rounded-md border border-line bg-raised px-2 py-1 text-sm text-fg outline-none transition-colors focus:border-line-strong"
        />
      ) : (
        task.focusNote && <p className="mt-0.5 whitespace-pre-wrap text-sm text-fg-muted">{task.focusNote}</p>
      )}
    </li>
  )
}

/** Today's pinned tasks, numbered in "My order", each with an optional note (double-click or the pencil to edit). */
export function Focus({ occs }: { occs: Occurrence[] }) {
  return (
    <section aria-label="Focus for today">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
        Focus for today
        {occs.length > 0 && <span className="tabular font-medium text-fg-subtle">{occs.length}</span>}
      </h2>
      {occs.length === 0 ? (
        <p className="text-base text-fg-muted">Star any of today’s tasks to keep it in focus here.</p>
      ) : (
        <ol className="grid gap-1 rounded-lg border border-line bg-raised p-1.5 shadow-card">
          {occs.map((occ, index) => (
            <FocusItem key={occ.key} occ={occ} n={index + 1} />
          ))}
        </ol>
      )}
    </section>
  )
}
