import { CalendarCheck, CheckCheck, Flame, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo } from 'react'

import { QuickAdd } from '@/components/task/QuickAdd'
import { TaskRow } from '@/components/task/TaskRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { friendlyDate, shiftDate, todayStr } from '@/lib/dates'
import { compareByDue, isOverdue, listOccurrences } from '@/lib/recurrence'
import { computeStats } from '@/lib/stats'
import { useTasksStore } from '@/store/tasks'
import type { Occurrence } from '@/types/model'

function Stat({ icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-raised px-4 py-3 shadow-card">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon icon={icon} />
      </span>
      <div>
        <div className="tabular font-display text-xl leading-none">{value}</div>
        <div className="mt-1 text-sm text-fg-muted">{label}</div>
      </div>
    </div>
  )
}

function Section({ title, count, tone, children }: { title: string; count?: number; tone?: 'overdue'; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 flex items-baseline gap-2 font-display text-md">
        <span className={tone === 'overdue' ? 'text-overdue' : undefined}>{title}</span>
        {count !== undefined && <span className="tabular font-sans text-sm text-fg-subtle">{count}</span>}
      </h2>
      {children}
    </section>
  )
}

export function TodayView() {
  const tasks = useTasksStore((state) => state.tasks)
  const today = todayStr()

  const { overdue, dueToday, upcoming, stats } = useMemo(() => {
    const all = listOccurrences(tasks, today)
    const weekEnd = shiftDate(today, 7)
    const sorted = (list: Occurrence[]) => [...list].sort(compareByDue)
    return {
      overdue: sorted(all.filter((occ) => isOverdue(occ, today))),
      dueToday: sorted(all.filter((occ) => occ.date === today)),
      upcoming: sorted(all.filter((occ) => occ.date !== null && occ.date > today && occ.date <= weekEnd && !occ.done)),
      stats: computeStats(tasks, today),
    }
  }, [tasks, today])

  const upcomingByDate = new Map<string, Occurrence[]>()
  for (const occ of upcoming) {
    if (!occ.date) continue
    upcomingByDate.set(occ.date, [...(upcomingByDate.get(occ.date) ?? []), occ])
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={CheckCheck} value={stats.doneToday} label="Completed today" />
        <Stat icon={CalendarCheck} value={stats.doneThisWeek} label="Completed this week" />
        <Stat icon={Flame} value={stats.streak} label="Day streak" />
      </div>

      <QuickAdd dueDate={today} label="Add a task for today…" />

      {overdue.length > 0 && (
        <Section title="Overdue" count={overdue.length} tone="overdue">
          <div className="grid gap-2">
            {overdue.map((occ) => (
              <TaskRow key={occ.key} occ={occ} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Today" count={dueToday.length}>
        {dueToday.length === 0 ? (
          <div className="rounded-lg border border-line bg-raised shadow-card">
            <EmptyState
              icon={Sparkles}
              title="Nothing due today"
              description={overdue.length ? 'Clear the overdue items above, or plan ahead.' : 'Enjoy the space, or add something above.'}
            />
          </div>
        ) : (
          <div className="grid gap-2">
            {dueToday.map((occ) => (
              <TaskRow key={occ.key} occ={occ} hideDate />
            ))}
          </div>
        )}
      </Section>

      <Section title="Next 7 days" count={upcoming.length}>
        {upcoming.length === 0 ? (
          <p className="text-base text-fg-muted">Nothing scheduled for the coming week.</p>
        ) : (
          <div className="grid gap-5">
            {[...upcomingByDate.entries()].map(([date, occs]) => (
              <div key={date}>
                <h3 className="mb-1.5 text-sm font-medium text-fg-muted">{friendlyDate(date, today)}</h3>
                <div className="grid gap-2">
                  {occs.map((occ) => (
                    <TaskRow key={occ.key} occ={occ} hideDate />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
