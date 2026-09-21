import { CalendarDays } from 'lucide-react'
import { useMemo } from 'react'

import { QuickAdd } from '@/components/task/QuickAdd'
import { TaskRow } from '@/components/task/TaskRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { compareByDue, expandOccurrences } from '@/lib/recurrence'
import { useTasksStore } from '@/store/tasks'

/** Tasks for one date plus a quick-add box; used by Day view and the date sheet. */
export function DayPanel({ date }: { date: string }) {
  const tasks = useTasksStore((state) => state.tasks)
  const occs = useMemo(() => expandOccurrences(tasks, date, date).sort(compareByDue), [tasks, date])

  return (
    <div className="grid gap-4">
      <QuickAdd dueDate={date} placeholder="Quick add a task for this day…" />
      {occs.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Add a task above to plan this day." />
      ) : (
        <div className="grid gap-2">
          {occs.map((occ) => (
            <TaskRow key={occ.key} occ={occ} hideDate />
          ))}
        </div>
      )}
    </div>
  )
}
