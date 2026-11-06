import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { differenceInCalendarDays } from 'date-fns'
import { Bell, ClockAlert, GripVertical, Pin, Repeat } from 'lucide-react'
import type { ReactNode } from 'react'

import { Checkbox } from '@/components/ui/Checkbox'
import { Icon } from '@/components/ui/Icon'
import { useTaskActions } from '@/hooks/useTaskActions'
import { useTaskFocus } from '@/hooks/useTaskFocus'
import { cx } from '@/lib/cx'
import { formatTime, friendlyDate, fromDateStr, todayStr } from '@/lib/dates'
import { isOverdue, isRecurring } from '@/lib/recurrence'
import { UNCATEGORIZED, categoryFor, orderAfterMove, subtaskProgress } from '@/lib/tasks'
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
  /** Drag handle from SortableTaskList, shown at the right edge. */
  dragHandle?: ReactNode
  /** Show the pin button that adds the task to today's Pinned tasks (Dashboard, today only). */
  pinnable?: boolean
}

export function TaskRow({ occ, selectable = false, selected = false, onSelect, hideDate = false, dragHandle, pinnable = false }: TaskRowProps) {
  const categories = useTasksStore((state) => state.categories)
  const openEditor = useUiStore((state) => state.openEditor)
  const { setDone, guard } = useTaskActions()
  const focusHandlers = useTaskFocus(occ.task.id)

  const { task } = occ
  const category = categoryFor(task.categoryId, categories)
  const today = todayStr()
  const overdue = isOverdue(occ, today)
  const daysLate = overdue && occ.date ? differenceInCalendarDays(fromDateStr(today), fromDateStr(occ.date)) : 0
  const tinted = category !== UNCATEGORIZED
  const progress = subtaskProgress(task)
  const pinned = task.focusDate === today

  return (
    <div
      {...focusHandlers}
      // A light wash of the category color; uncategorized tasks keep the plain card.
      style={tinted && !selected ? { background: `color-mix(in srgb, rgb(var(--cat-${category.colorKey})) var(--tint), rgb(var(--raised)))` } : undefined}
      className={cx(
        'group relative flex items-start gap-3 overflow-hidden rounded-md border border-line bg-raised py-2.5 pl-4 pr-3 shadow-card transition-colors hover:border-line-strong',
        overdue && 'shadow-[inset_2px_0_0_rgb(var(--fg))]',
        selected && 'border-accent/50 bg-accent-soft/50',
      )}
    >
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
            <span className="inline-flex items-center gap-1">{friendlyDate(occ.date)}</span>
          )}
          {overdue && (
            <span className="inline-flex items-center gap-1 font-semibold text-fg">
              <Icon icon={ClockAlert} size={14} />
              {daysLate}d late
            </span>
          )}
          {task.dueTime && <span className="tabular">{formatTime(task.dueTime)}</span>}
          {(task.reminderTime ?? task.alerts.length > 0) && !occ.done && (
            <span className="tabular inline-flex items-center gap-1" title="Alerts set">
              <Icon icon={Bell} size={14} />
              <span className="sr-only">{task.reminderTime ? 'Reminder at' : 'Alerts set'}</span>
              {task.reminderTime ? formatTime(task.reminderTime) : task.alerts.length}
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
      {pinnable && (
        <button
          type="button"
          onClick={() =>
            void guard(() => {
              const { tasks, saveTask } = useTasksStore.getState()
              const latest = tasks.find((existing) => existing.id === task.id) ?? task
              return saveTask({ ...latest, focusDate: pinned ? null : today })
            })
          }
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${task.title}` : `Pin ${task.title}`}
          title={pinned ? 'Unpin' : 'Pin to Pinned tasks'}
          className={cx(
            '-my-1 self-center rounded-md p-1 transition-colors hover:bg-sunken hover:text-fg',
            pinned ? 'text-highlight' : 'text-fg-subtle opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
          )}
        >
          <Icon icon={Pin} size={16} className={pinned ? 'fill-current' : undefined} />
        </button>
      )}
      <PriorityMark priority={task.priority} />
      {dragHandle}
    </div>
  )
}

function SortableItem({ occ, render }: { occ: Occurrence; render: (occ: Occurrence, handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: occ.key })
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reorder ${occ.task.title}`}
      className="-my-1 -mr-1 cursor-grab touch-none self-center rounded-md p-1 text-fg-subtle transition-colors hover:bg-sunken hover:text-fg active:cursor-grabbing"
    >
      <Icon icon={GripVertical} size={16} />
    </button>
  )
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(isDragging && 'relative z-10 opacity-90')}
    >
      {render(occ, handle)}
    </div>
  )
}

interface SortableTaskListProps {
  /** Shown in "My order"; dragging saves new positions for the whole app. */
  occs: Occurrence[]
  /** Renders rows without handles (e.g. while another sort is active). */
  disabled?: boolean
  render?: (occ: Occurrence, handle: ReactNode) => ReactNode
}

const defaultRow = (occ: Occurrence, handle: ReactNode) => <TaskRow occ={occ} hideDate dragHandle={handle} />

/** A task list you can reorder by dragging each row's grip (or Space + arrow keys on it). */
export function SortableTaskList({ occs, disabled = false, render = defaultRow }: SortableTaskListProps) {
  const reorderTasks = useTasksStore((state) => state.reorderTasks)
  const { guard } = useTaskActions()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const keys = occs.map((occ) => occ.key)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    void guard(() => reorderTasks(orderAfterMove(occs, keys.indexOf(String(active.id)), keys.indexOf(String(over.id)))))
  }

  if (disabled) return <div className="grid gap-2">{occs.map((occ) => <div key={occ.key}>{render(occ, null)}</div>)}</div>
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={keys} strategy={verticalListSortingStrategy}>
        <div className="grid gap-2">
          {occs.map((occ) => (
            <SortableItem key={occ.key} occ={occ} render={render} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
