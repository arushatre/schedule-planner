import { CalendarDays } from 'lucide-react'
import { useMemo } from 'react'

import { ClassRow } from '@/components/task/ClassBits'
import { TaskRow } from '@/components/task/TaskRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { daysBetween, friendlyDate, shiftDate } from '@/lib/dates'
import { compareByDue, expandOccurrences } from '@/lib/recurrence'
import { blocksOn } from '@/lib/schedule'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import type { ClassBlock, Occurrence } from '@/types/model'

export const AGENDA_DAYS = 30

export function AgendaView({ cursor, today }: { cursor: string; today: string }) {
  const tasks = useTasksStore((state) => state.tasks)
  const classBlocks = useTasksStore((state) => state.classBlocks)
  const showClasses = useUiStore((state) => state.showClasses)

  const days = useMemo(() => {
    const last = shiftDate(cursor, AGENDA_DAYS - 1)
    const occs = expandOccurrences(tasks, cursor, last).sort(compareByDue)
    const byDate = new Map<string, { occs: Occurrence[]; classes: ClassBlock[] }>()
    const entry = (date: string) => byDate.get(date) ?? { occs: [], classes: [] }
    for (const occ of occs) {
      if (occ.date) byDate.set(occ.date, { ...entry(occ.date), occs: [...entry(occ.date).occs, occ] })
    }
    if (showClasses) {
      for (const date of daysBetween(cursor, last)) {
        const classes = blocksOn(classBlocks, date)
        if (classes.length) byDate.set(date, { ...entry(date), classes })
      }
    }
    return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
  }, [tasks, classBlocks, showClasses, cursor])

  if (days.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-raised shadow-card">
        <EmptyState
          icon={CalendarDays}
          title="Nothing on the agenda"
          description={`No tasks in the ${AGENDA_DAYS} days starting ${friendlyDate(cursor, today)}.`}
        />
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      {days.map(([date, { occs, classes }]) => (
        <section key={date} aria-label={friendlyDate(date, today)}>
          <h2 className="mb-2 font-display text-md">{friendlyDate(date, today)}</h2>
          <div className="grid gap-2">
            {classes.map((block) => (
              <ClassRow key={block.id} block={block} />
            ))}
            {occs.map((occ) => (
              <TaskRow key={occ.key} occ={occ} hideDate />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
