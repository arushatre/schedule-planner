import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'

import { Chip } from '@/components/ui/Chip'
import { cx } from '@/lib/cx'
import { formatTime } from '@/lib/dates'
import { isOverdue } from '@/lib/recurrence'
import { categoryFor } from '@/lib/tasks'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import type { Occurrence } from '@/types/model'

export interface DragData {
  occ: Occurrence
}

export function isDragData(value: unknown): value is DragData {
  return typeof value === 'object' && value !== null && 'occ' in value
}

/** A chip's visual, shared by the in-grid chip and the drag overlay. */
export function OccurrenceChip({ occ, today }: { occ: Occurrence; today: string }) {
  const categories = useTasksStore((state) => state.categories)
  const category = categoryFor(occ.task.categoryId, categories)
  return (
    <Chip
      label={occ.task.title}
      color={category.colorKey}
      time={occ.task.dueTime ? formatTime(occ.task.dueTime) : undefined}
      overdue={isOverdue(occ, today)}
      done={occ.done}
    />
  )
}

export function DraggableChip({ occ, today }: { occ: Occurrence; today: string }) {
  const openEditor = useUiStore((state) => state.openEditor)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: occ.key, data: { occ } satisfies DragData })

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => openEditor({ mode: 'edit', taskId: occ.task.id })}
      className={cx('block w-full cursor-grab touch-manipulation text-left active:cursor-grabbing', isDragging && 'opacity-40')}
    >
      <OccurrenceChip occ={occ} today={today} />
    </button>
  )
}

/** A date that chips can be dropped on. The highlight is a tint, never a glow. */
export function DayDrop({ date, className, children }: { date: string; className?: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: date })
  return (
    <div
      ref={setNodeRef}
      data-date={date}
      className={cx(className, 'transition-colors', isOver && '!bg-accent-soft')}
    >
      {children}
    </div>
  )
}
