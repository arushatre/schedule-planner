import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { addDays, addMonths, endOfWeek, format, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'
import { Segmented } from '@/components/ui/fields'
import { useTaskActions } from '@/hooks/useTaskActions'
import { WEEK_OPTIONS, friendlyDate, fromDateStr, toDateStr, todayStr } from '@/lib/dates'
import { useUiStore } from '@/store/ui'
import type { CalendarMode } from '@/store/ui'
import type { Occurrence } from '@/types/model'
import { AGENDA_DAYS, AgendaView } from './AgendaView'
import { DayPanel } from './DayPanel'
import { MonthGrid } from './MonthGrid'
import { WeekView } from './WeekView'
import { OccurrenceChip, isDragData } from './dnd'

const MODES: { value: CalendarMode; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
]

function shift(cursor: string, mode: CalendarMode, direction: 1 | -1): string {
  const date = fromDateStr(cursor)
  switch (mode) {
    case 'month':
      return toDateStr(addMonths(date, direction))
    case 'week':
      return toDateStr(addDays(date, 7 * direction))
    case 'day':
      return toDateStr(addDays(date, direction))
    case 'agenda':
      return toDateStr(addDays(date, AGENDA_DAYS * direction))
  }
}

function title(cursor: string, mode: CalendarMode): string {
  const date = fromDateStr(cursor)
  switch (mode) {
    case 'month':
      return format(date, 'MMMM yyyy')
    case 'week': {
      const start = startOfWeek(date, WEEK_OPTIONS)
      const end = endOfWeek(date, WEEK_OPTIONS)
      return `${format(start, 'MMM d')} – ${format(end, start.getMonth() === end.getMonth() ? 'd, yyyy' : 'MMM d, yyyy')}`
    }
    case 'day':
      return format(date, 'EEEE, MMMM d')
    case 'agenda':
      return `${format(date, 'MMM d')} – ${format(addDays(date, AGENDA_DAYS - 1), 'MMM d')}`
  }
}

export function CalendarView() {
  const { calendarMode: mode, calendarCursor: cursor, setCalendarMode, setCalendarCursor } = useUiStore()
  const daySheet = useUiStore((state) => state.daySheet)
  const openDaySheet = useUiStore((state) => state.openDaySheet)
  const { move } = useTaskActions()
  const [dragging, setDragging] = useState<Occurrence | null>(null)
  const today = todayStr()

  // Mouse needs a small move before a drag starts so clicks still open the editor;
  // touch needs a press-and-hold so scrolling isn't hijacked. Space picks up with the keyboard.
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
    if (!isDragData(data) || typeof target !== 'string') return
    if (data.occ.date !== target) void move(data.occ, target)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous"
            onClick={() => setCalendarCursor(shift(cursor, mode, -1))}
          >
            <Icon icon={ChevronLeft} />
          </Button>
          <Button size="sm" onClick={() => setCalendarCursor(today)}>
            Today
          </Button>
          <Button variant="ghost" size="sm" aria-label="Next" onClick={() => setCalendarCursor(shift(cursor, mode, 1))}>
            <Icon icon={ChevronRight} />
          </Button>
        </div>
        <h2 className="mr-auto font-display text-lg" aria-live="polite">
          {title(cursor, mode)}
        </h2>
        <Segmented ariaLabel="Calendar view" options={MODES} value={mode} onChange={setCalendarMode} />
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        {mode === 'month' && <MonthGrid cursor={cursor} today={today} />}
        {mode === 'week' && <WeekView cursor={cursor} today={today} />}
        {mode === 'day' && <DayPanel date={cursor} />}
        {mode === 'agenda' && <AgendaView cursor={cursor} today={today} />}
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="w-44 shadow-pop">
              <OccurrenceChip occ={dragging} today={today} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Dialog
        open={daySheet !== null}
        onClose={() => openDaySheet(null)}
        title={daySheet ? friendlyDate(daySheet, today) : ''}
      >
        {daySheet && <DayPanel date={daySheet} />}
      </Dialog>
    </div>
  )
}
