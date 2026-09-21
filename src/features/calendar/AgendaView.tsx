import { CalendarDays } from 'lucide-react'
import { useMemo } from 'react'

import { TaskRow } from '@/components/task/TaskRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { friendlyDate, shiftDate } from '@/lib/dates'
import { compareByDue, expandOccurrences } from '@/lib/recurrence'
import { useTasksStore } from '@/store/tasks'
import type { Occurrence } from '@/types/model'

export const AGENDA_DAYS = 30

export function AgendaView({ cursor, today }: { cursor: string; today: string }) {
  const tasks = useTasksStore((state) => state.tasks)

  const days = useMemo(() => {
    const occs = expandOccurrences(tasks, cursor, shiftDate(cursor, AGENDA_DAYS - 1)).sort(compareByDue)
    const map = new Map<string, Occurrence[]>()
    for (const occ of occs) {
      if (occ.date) map.set(occ.date, [...(map.get(occ.date) ?? []), occ])
    }
    return [...map.entries()]
  }, [tasks, cursor])

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
      {days.map(([date, occs]) => (
        <section key={date} aria-label={friendlyDate(date, today)}>
          <h2 className="mb-2 font-display text-md">{friendlyDate(date, today)}</h2>
          <div className="grid gap-2">
            {occs.map((occ) => (
              <TaskRow key={occ.key} occ={occ} hideDate />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
