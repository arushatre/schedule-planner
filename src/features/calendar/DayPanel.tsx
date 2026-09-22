import { CalendarDays } from 'lucide-react'
import { useMemo } from 'react'

import { ClassRow } from '@/components/task/ClassBits'
import { QuickAdd } from '@/components/task/QuickAdd'
import { TaskRow } from '@/components/task/TaskRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { compareByDue, expandOccurrences } from '@/lib/recurrence'
import { blocksOn } from '@/lib/schedule'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'

/** Tasks for one date plus a quick-add box; used by Day view and the date sheet. */
export function DayPanel({ date }: { date: string }) {
  const tasks = useTasksStore((state) => state.tasks)
  const classBlocks = useTasksStore((state) => state.classBlocks)
  const showClasses = useUiStore((state) => state.showClasses)
  const occs = useMemo(() => expandOccurrences(tasks, date, date).sort(compareByDue), [tasks, date])
  const classes = useMemo(() => (showClasses ? blocksOn(classBlocks, date) : []), [classBlocks, showClasses, date])

  return (
    <div className="grid gap-4">
      <QuickAdd dueDate={date} label="Quick add a task for this day…" />
      {classes.length > 0 && (
        <section aria-label="Classes" className="grid gap-2">
          {classes.map((block) => (
            <ClassRow key={block.id} block={block} />
          ))}
        </section>
      )}
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
