import { eachDayOfInterval, endOfMonth, endOfWeek, format, getMonth, startOfMonth, startOfWeek } from 'date-fns'
import { GraduationCap, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CategoryDot } from '@/components/task/TaskBits'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'
import { WEEK_OPTIONS, fromDateStr, toDateStr } from '@/lib/dates'
import { compareByDue, expandOccurrences } from '@/lib/recurrence'
import { blocksOn } from '@/lib/schedule'
import { categoryFor } from '@/lib/tasks'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import type { Occurrence } from '@/types/model'
import { DayDrop, DraggableChip } from './dnd'

const MAX_VISIBLE = 3

export function MonthGrid({ cursor, today }: { cursor: string; today: string }) {
  const tasks = useTasksStore((state) => state.tasks)
  const categories = useTasksStore((state) => state.categories)
  const openDaySheet = useUiStore((state) => state.openDaySheet)
  const openEditor = useUiStore((state) => state.openEditor)
  const showClasses = useUiStore((state) => state.showClasses)
  const classBlocks = useTasksStore((state) => state.classBlocks)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const monthStart = startOfMonth(fromDateStr(cursor))
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(monthStart, WEEK_OPTIONS),
        end: endOfWeek(endOfMonth(monthStart), WEEK_OPTIONS),
      }),
    [monthStart.getTime()], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const byDate = useMemo(() => {
    const first = toDateStr(days[0] ?? monthStart)
    const last = toDateStr(days[days.length - 1] ?? monthStart)
    const map = new Map<string, Occurrence[]>()
    for (const occ of expandOccurrences(tasks, first, last).sort(compareByDue)) {
      if (!occ.date) continue
      map.set(occ.date, [...(map.get(occ.date) ?? []), occ])
    }
    return map
  }, [tasks, days, monthStart])

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-raised shadow-card">
      <div className="grid grid-cols-7 border-b border-line bg-panel text-center text-xs font-medium uppercase tracking-wide text-fg-muted">
        {days.slice(0, 7).map((day) => (
          <div key={day.getTime()} className="py-2">
            {format(day, 'EEE')}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const key = toDateStr(day)
          const occs = byDate.get(key) ?? []
          const isToday = key === today
          const inMonth = getMonth(day) === getMonth(monthStart)
          const showAll = expanded.has(key)
          const visible = showAll ? occs : occs.slice(0, MAX_VISIBLE)
          const hidden = occs.length - visible.length
          const classCount = showClasses ? blocksOn(classBlocks, key).length : 0

          return (
            <DayDrop
              key={key}
              date={key}
              className={cx(
                'group relative flex min-h-[4.5rem] flex-col gap-1 border-b border-r border-line p-1 md:min-h-[8rem] md:p-1.5',
                (index + 1) % 7 === 0 && 'border-r-0',
                !inMonth && 'bg-panel/60',
              )}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  aria-label={`${format(day, 'EEEE, MMMM d')}${occs.length ? `, ${occs.length} tasks` : ''}`}
                  aria-current={isToday ? 'date' : undefined}
                  onClick={() => openDaySheet(key)}
                  className={cx(
                    'tabular flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm transition-colors',
                    'after:absolute after:inset-0 after:content-[""]',
                    isToday ? 'bg-accent font-medium text-accent-fg' : inMonth ? 'text-fg hover:bg-sunken' : 'text-fg-subtle hover:bg-sunken',
                  )}
                >
                  {format(day, 'd')}
                </button>
                <button
                  type="button"
                  aria-label={`Add task on ${format(day, 'MMMM d')}`}
                  onClick={() => openEditor({ mode: 'new', dueDate: key })}
                  className="relative z-10 hidden rounded-sm p-0.5 text-fg-subtle opacity-0 transition-opacity hover:bg-sunken hover:text-fg focus:opacity-100 group-hover:opacity-100 md:block"
                >
                  <Icon icon={Plus} size={14} />
                </button>
              </div>

              <div className="relative z-10 hidden gap-1 md:grid">
                {visible.map((occ) => (
                  <DraggableChip key={occ.key} occ={occ} today={today} />
                ))}
                {classCount > 0 && (
                  <span className="flex items-center gap-1 px-1 text-xs text-fg-subtle">
                    <Icon icon={GraduationCap} size={12} />
                    {classCount} {classCount === 1 ? 'class' : 'classes'}
                  </span>
                )}
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded(new Set(expanded).add(key))}
                    className="rounded-sm px-1 text-left text-xs text-fg-muted transition-colors hover:bg-sunken hover:text-fg"
                  >
                    +{hidden} more
                  </button>
                )}
                {showAll && occs.length > MAX_VISIBLE && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set(expanded)
                      next.delete(key)
                      setExpanded(next)
                    }}
                    className="rounded-sm px-1 text-left text-xs text-fg-muted transition-colors hover:bg-sunken hover:text-fg"
                  >
                    Show less
                  </button>
                )}
              </div>

              {/* Phones: dots only; tap the day for the full list. */}
              <div className="flex flex-wrap gap-0.5 px-0.5 md:hidden" aria-hidden="true">
                {occs.slice(0, 4).map((occ) => (
                  <CategoryDot key={occ.key} color={categoryFor(occ.task.categoryId, categories).colorKey} className="h-1.5 w-1.5" />
                ))}
                {occs.length > 4 && <span className="text-[10px] leading-none text-fg-muted">+{occs.length - 4}</span>}
              </div>
            </DayDrop>
          )
        })}
      </div>
    </div>
  )
}
