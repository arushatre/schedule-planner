import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { ClockAlert, Repeat } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CategoryDot, PriorityMark, ProgressBar } from '@/components/task/TaskBits'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Icon } from '@/components/ui/Icon'
import { isDragData } from '@/features/calendar/dnd'
import type { DragData } from '@/features/calendar/dnd'
import { useTaskActions } from '@/hooks/useTaskActions'
import { useTaskFocus } from '@/hooks/useTaskFocus'
import { cx } from '@/lib/cx'
import { formatTime, friendlyDate, todayStr } from '@/lib/dates'
import { occurrenceStatus } from '@/lib/filters'
import { isOverdue, isRecurring } from '@/lib/recurrence'
import { categoryFor, subtaskProgress } from '@/lib/tasks'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import { STATUSES, STATUS_LABEL } from '@/types/model'
import type { Occurrence, Status } from '@/types/model'

const COLUMN_PREFIX = 'column:'
/** The Done column grows forever; show the newest and let the rest expand. */
const DONE_LIMIT = 12

function CardBody({ occ }: { occ: Occurrence }) {
  const categories = useTasksStore((state) => state.categories)
  const { task } = occ
  const category = categoryFor(task.categoryId, categories)
  const overdue = isOverdue(occ, todayStr())
  const progress = subtaskProgress(task)

  return (
    <div className="min-w-0 flex-1">
      <span className={cx('block break-words text-base', occ.done && 'text-fg-subtle line-through')}>{task.title}</span>
      <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <CategoryDot color={category.colorKey} />
          {category.name}
        </span>
        {occ.date && (
          <span className={cx('inline-flex items-center gap-1', overdue && 'font-medium text-overdue')}>
            {overdue && <Icon icon={ClockAlert} size={13} />}
            {friendlyDate(occ.date)}
            {task.dueTime ? ` · ${formatTime(task.dueTime)}` : ''}
          </span>
        )}
        {isRecurring(task) && <Icon icon={Repeat} size={13} />}
        {progress.total > 0 && <ProgressBar done={progress.done} total={progress.total} />}
      </span>
    </div>
  )
}

function Card({ occ }: { occ: Occurrence }) {
  const openEditor = useUiStore((state) => state.openEditor)
  const focusHandlers = useTaskFocus(occ.task.id)
  const { setDone } = useTaskActions()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: occ.key, data: { occ } satisfies DragData })
  const overdue = isOverdue(occ, todayStr())

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      {...focusHandlers}
      // The card contains a checkbox and a button, so it is a group, not a button.
      role="group"
      aria-label={occ.task.title}
      className={cx(
        'flex cursor-grab touch-manipulation items-start gap-2.5 rounded-md border bg-raised p-3 shadow-card transition-colors active:cursor-grabbing',
        overdue ? 'border-overdue/40' : 'border-line hover:border-line-strong',
        isDragging && 'opacity-40',
      )}
    >
      <Checkbox
        checked={occ.done}
        onChange={(done) => void setDone(occ, done)}
        ariaLabel={`Complete ${occ.task.title}`}
        className="mt-0.5"
      />
      <button
        type="button"
        onClick={() => openEditor({ mode: 'edit', taskId: occ.task.id })}
        className="flex min-w-0 flex-1 text-left"
      >
        <CardBody occ={occ} />
      </button>
      <PriorityMark priority={occ.task.priority} />
    </div>
  )
}

function Column({ status, occurrences }: { status: Status; occurrences: Occurrence[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${status}` })
  const [showAll, setShowAll] = useState(false)
  const limited = status === 'done' && !showAll && occurrences.length > DONE_LIMIT
  const visible = limited ? occurrences.slice(0, DONE_LIMIT) : occurrences

  return (
    <section
      ref={setNodeRef}
      aria-label={STATUS_LABEL[status]}
      className={cx(
        'flex min-h-[10rem] flex-col gap-2 rounded-lg border p-3 transition-colors',
        isOver ? 'border-accent/60 bg-accent-soft' : 'border-line bg-panel',
      )}
    >
      <h2 className="flex items-baseline gap-2 px-1 font-display text-md">
        {STATUS_LABEL[status]}
        <span className="tabular font-sans text-sm text-fg-subtle">{occurrences.length}</span>
      </h2>
      {visible.map((occ) => (
        <Card key={occ.key} occ={occ} />
      ))}
      {occurrences.length === 0 && (
        <p className="px-1 py-4 text-center text-sm text-fg-subtle">Drop a task here</p>
      )}
      {limited && (
        <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>
          Show {occurrences.length - DONE_LIMIT} more
        </Button>
      )}
    </section>
  )
}

/** Kanban view of the (already filtered and sorted) list. Drag a card to change its status. */
export function Board({ occurrences }: { occurrences: Occurrence[] }) {
  const { setStatus } = useTaskActions()
  const [dragging, setDragging] = useState<Occurrence | null>(null)

  const columns = useMemo(() => {
    const byStatus: Record<Status, Occurrence[]> = { not_started: [], in_progress: [], done: [] }
    for (const occ of occurrences) byStatus[occurrenceStatus(occ)].push(occ)
    // Newest completions first in Done, so the cap keeps the recent ones.
    byStatus.done.sort((a, b) => (b.task.completedAt ?? b.task.updatedAt) - (a.task.completedAt ?? a.task.updatedAt))
    return byStatus
  }, [occurrences])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] } }),
  )

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    if (isDragData(data)) setDragging(data.occ)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null)
    const data = event.active.data.current
    const target = event.over?.id
    if (!isDragData(data) || typeof target !== 'string' || !target.startsWith(COLUMN_PREFIX)) return
    const status = STATUSES.find((candidate) => candidate === target.slice(COLUMN_PREFIX.length))
    if (status && status !== occurrenceStatus(data.occ)) void setStatus(data.occ, status)
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="grid items-start gap-4 md:grid-cols-3">
        {STATUSES.map((status) => (
          <Column key={status} status={status} occurrences={columns[status]} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="flex items-start gap-2.5 rounded-md border border-line-strong bg-raised p-3 shadow-pop">
            <CardBody occ={dragging} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
