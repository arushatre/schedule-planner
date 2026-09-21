import { addDays, format, startOfWeek } from 'date-fns'
import { Plus } from 'lucide-react'
import { useMemo } from 'react'

import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'
import { WEEK_OPTIONS, fromDateStr, toDateStr } from '@/lib/dates'
import { compareByDue, expandOccurrences } from '@/lib/recurrence'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import type { Occurrence } from '@/types/model'
import { DayDrop, DraggableChip } from './dnd'

export function WeekView({ cursor, today }: { cursor: string; today: string }) {
  const tasks = useTasksStore((state) => state.tasks)
  const openEditor = useUiStore((state) => state.openEditor)
  const openDaySheet = useUiStore((state) => state.openDaySheet)

  const start = startOfWeek(fromDateStr(cursor), WEEK_OPTIONS)
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))

  const byDate = useMemo(() => {
    const map = new Map<string, Occurrence[]>()
    const first = toDateStr(start)
    const last = toDateStr(addDays(start, 6))
    for (const occ of expandOccurrences(tasks, first, last).sort(compareByDue)) {
      if (!occ.date) continue
      map.set(occ.date, [...(map.get(occ.date) ?? []), occ])
    }
    return map
  }, [tasks, start.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid gap-3 overflow-hidden md:grid-cols-7 md:gap-0 md:rounded-lg md:border md:border-line md:bg-raised md:shadow-card">
      {days.map((day, index) => {
        const key = toDateStr(day)
        const occs = byDate.get(key) ?? []
        const isToday = key === today
        return (
          <DayDrop
            key={key}
            date={key}
            className={cx(
              'group flex min-h-[8rem] flex-col gap-2 rounded-lg border border-line bg-raised p-2.5 shadow-card md:min-h-[26rem] md:rounded-none md:border-0 md:border-r md:shadow-none',
              index === 6 && 'md:border-r-0',
              isToday && 'bg-accent-soft/40',
            )}
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => openDaySheet(key)}
                aria-current={isToday ? 'date' : undefined}
                aria-label={format(day, 'EEEE, MMMM d')}
                className="flex items-baseline gap-2 rounded-md px-1 transition-colors hover:bg-sunken"
              >
                <span className="text-xs font-medium uppercase tracking-wide text-fg-muted">{format(day, 'EEE')}</span>
                <span
                  className={cx(
                    'tabular flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 font-display text-md',
                    isToday && 'bg-accent text-accent-fg',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Add task on ${format(day, 'MMMM d')}`}
                onClick={() => openEditor({ mode: 'new', dueDate: key })}
                className="rounded-sm p-1 text-fg-subtle transition-colors hover:bg-sunken hover:text-fg"
              >
                <Icon icon={Plus} size={16} />
              </button>
            </div>
            <div className="grid content-start gap-1.5">
              {occs.map((occ) => (
                <DraggableChip key={occ.key} occ={occ} today={today} />
              ))}
            </div>
          </DayDrop>
        )
      })}
    </div>
  )
}
