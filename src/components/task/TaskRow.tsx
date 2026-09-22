import { Bell, ClockAlert, Repeat } from 'lucide-react'

import { Checkbox } from '@/components/ui/Checkbox'
import { Icon } from '@/components/ui/Icon'
import { useTaskActions } from '@/hooks/useTaskActions'
import { useTaskFocus } from '@/hooks/useTaskFocus'
import { cx } from '@/lib/cx'
import { formatTime, friendlyDate, todayStr } from '@/lib/dates'
import { isOverdue, isRecurring } from '@/lib/recurrence'
import { categoryFor, subtaskProgress } from '@/lib/tasks'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import type { Occurrence } from '@/types/model'
import { CategoryDot, PriorityMark, ProgressBar } from './TaskBits'

interface TaskRowProps {
  occ: Occurrence
  /** Show a selection checkbox (bulk mode). */
  selectable?: boolean
  selected?: boolean
  onSelect?: (selected: boolean) => void
  /** Hide the date in contexts where it is already the heading. */
  hideDate?: boolean
}

export function TaskRow({ occ, selectable = false, selected = false, onSelect, hideDate = false }: TaskRowProps) {
  const categories = useTasksStore((state) => state.categories)
  const openEditor = useUiStore((state) => state.openEditor)
  const { setDone } = useTaskActions()
  const focusHandlers = useTaskFocus(occ.task.id)

  const { task } = occ
  const category = categoryFor(task.categoryId, categories)
  const overdue = isOverdue(occ, todayStr())
  const progress = subtaskProgress(task)

  return (
    <div
      {...focusHandlers}
      className={cx(
        'relative flex items-start gap-3 overflow-hidden rounded-md border py-2.5 pl-4 pr-3 shadow-card transition-colors',
        overdue
          ? 'border-overdue/30 bg-overdue-soft/60 hover:border-overdue/50'
          : 'border-line bg-raised hover:border-line-strong',
        selected && 'border-accent/50 bg-accent-soft/50',
      )}
    >
      {overdue && <span aria-hidden="true" className="overdue-edge absolute inset-y-0 left-0 w-1.5" />}
      {selectable && (
        <Checkbox
          checked={selected}
          onChange={(value) => onSelect?.(value)}
          ariaLabel={`Select ${task.title}`}
          className="mt-0.5"
        />
      )}
      <Checkbox
        checked={occ.done}
        onChange={(done) => void setDone(occ, done)}
        ariaLabel={`Complete ${task.title}`}
        className="mt-0.5"
      />
      <button
        type="button"
        onClick={() => openEditor({ mode: 'edit', taskId: task.id })}
        className="min-w-0 flex-1 text-left"
      >
        <span className={cx('block truncate text-base', occ.done && 'text-fg-subtle line-through')}>
          {task.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <CategoryDot color={category.colorKey} />
            {category.name}
          </span>
          {occ.date && !hideDate && (
            <span className={cx('inline-flex items-center gap-1', overdue && 'font-medium text-overdue')}>
              {overdue && <Icon icon={ClockAlert} size={14} />}
              {overdue ? 'Overdue · ' : ''}
              {friendlyDate(occ.date)}
            </span>
          )}
          {occ.date && hideDate && overdue && (
            <span className="inline-flex items-center gap-1 font-medium text-overdue">
              <Icon icon={ClockAlert} size={14} />
              Overdue
            </span>
          )}
          {task.dueTime && <span className="tabular">{formatTime(task.dueTime)}</span>}
          {task.reminderTime && !occ.done && (
            <span className="tabular inline-flex items-center gap-1" title="Reminder">
              <Icon icon={Bell} size={14} />
              <span className="sr-only">Reminder at</span>
              {formatTime(task.reminderTime)}
            </span>
          )}
          {isRecurring(task) && (
            <span className="inline-flex items-center gap-1" title="Repeats">
              <Icon icon={Repeat} size={14} />
              <span className="sr-only">Repeats</span>
            </span>
          )}
          {task.tags.map((tag) => (
            <span key={tag} className="text-fg-subtle">
              #{tag}
            </span>
          ))}
          {progress.total > 0 && <ProgressBar done={progress.done} total={progress.total} />}
        </span>
      </button>
      <PriorityMark priority={task.priority} />
    </div>
  )
}
