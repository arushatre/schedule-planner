import { format, startOfWeek } from 'date-fns'
import { motion } from 'framer-motion'
import { CheckCheck, ChevronLeft, ChevronRight, CircleAlert, Clock, Flame, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { QuickAdd } from '@/components/task/QuickAdd'
import { TaskRow } from '@/components/task/TaskRow'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'
import { WEEK_OPTIONS, formatTime, friendlyDate, fromDateStr, shiftDate, toDateStr, todayStr } from '@/lib/dates'
import { compareByDue, expandOccurrences, isOverdue, listOccurrences } from '@/lib/recurrence'
import { computeStats } from '@/lib/stats'
import { useTasksStore } from '@/store/tasks'
import type { Occurrence } from '@/types/model'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
const byDue = (list: Occurrence[]) => [...list].sort(compareByDue)

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function Section({ title, count, tone, children }: { title: string; count?: number; tone?: 'overdue'; children: ReactNode }) {
  const overdue = tone === 'overdue'
  return (
    <section
      aria-label={title}
      className={cx(overdue && 'rounded-lg border border-l-[3px] border-vermilion-edge/30 border-l-vermilion-edge bg-vermilion-wash p-4 md:p-5')}
    >
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg">
        {overdue && <Icon icon={CircleAlert} size={18} className="text-vermilion-ink" />}
        <span className={overdue ? 'text-vermilion-ink' : undefined}>{title}</span>
        {count !== undefined && <span className="tabular font-sans text-base text-fg-subtle">{count}</span>}
      </h2>
      {children}
    </section>
  )
}

function Fact({ icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon icon={icon} size={18} className="text-fg-subtle" />
      {children}
    </span>
  )
}

interface HeroProps {
  todays: Occurrence[]
  overdueCount: number
  streak: number
  doneThisWeek: number
}

/** Big date, a one-line read of the day, and progress: the first thing you see each morning. */
function Hero({ todays, overdueCount, streak, doneThisWeek }: HeroProps) {
  const now = new Date()
  const nowTime = format(now, 'HH:mm')
  const done = todays.filter((occ) => occ.done).length
  const left = todays.length - done
  const next = todays.find((occ) => !occ.done && occ.task.dueTime !== null && occ.task.dueTime >= nowTime)

  let summary = 'Nothing planned today.'
  if (todays.length > 0) summary = left === 0 ? 'Everything’s done for today.' : `${plural(left, 'task')} left today.`
  if (overdueCount > 0) summary += ` ${plural(overdueCount, 'overdue task')} to catch up on.`

  return (
    <section aria-label="Today at a glance" className="grid gap-6 rounded-lg border border-sage-edge/50 bg-sage-wash p-6 shadow-pop md:p-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="tabular font-display text-2xl text-accent">{format(now, 'd')}</span>
        <div className="grid gap-1">
          <p className="text-md text-fg-muted">{format(now, 'EEEE, MMMM')}</p>
          <p className="font-display text-lg">
            {greeting(now.getHours())}. {summary}
          </p>
        </div>
      </div>

      {todays.length > 0 && (
        <div className="grid gap-2">
          <div className="flex justify-between text-base">
            <span className="text-fg-muted">Today’s progress</span>
            <span className="tabular font-medium">
              {done} of {todays.length} done
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Today’s progress"
            aria-valuemin={0}
            aria-valuemax={todays.length}
            aria-valuenow={done}
            className="h-2 overflow-hidden rounded-full bg-sage-edge/45"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
              style={{ width: `${(done / todays.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-8 gap-y-2 text-base text-fg-muted">
        {next && (
          <Fact icon={Clock}>
            Up next: <span className="font-medium text-fg">{next.task.title}</span> at {formatTime(next.task.dueTime ?? '')}
          </Fact>
        )}
        <span className="inline-flex items-center gap-2 rounded-full border border-mustard-edge/50 bg-mustard-wash px-3 py-0.5 text-fg">
          <Icon icon={Flame} size={16} className="text-mustard-ink" />
          {streak > 0 ? `${streak}-day streak` : 'Start a streak today'}
        </span>
        <Fact icon={CheckCheck}>{doneThisWeek} done this week</Fact>
      </div>
    </section>
  )
}

interface WeekStripProps {
  weekStart: string
  today: string
  selected: string
  occurrences: Occurrence[]
  onSelect: (date: string) => void
  onShift: (weeks: number) => void
}

/** Seven tappable days with a dot per task (filled = still open), like a planner's week tabs. */
function WeekStrip({ weekStart, today, selected, occurrences, onSelect, onShift }: WeekStripProps) {
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index))
  const isThisWeek = days.includes(today)

  return (
    <section aria-label="Week" className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">Week of {format(fromDateStr(weekStart), 'MMMM d')}</h2>
        <div className="flex items-center gap-1">
          {!isThisWeek && (
            <Button variant="ghost" size="sm" onClick={() => onShift(0)}>
              This week
            </Button>
          )}
          <Button variant="ghost" size="sm" icon={ChevronLeft} aria-label="Previous week" onClick={() => onShift(-1)} />
          <Button variant="ghost" size="sm" icon={ChevronRight} aria-label="Next week" onClick={() => onShift(1)} />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 rounded-lg border border-mustard-edge/40 bg-mustard-wash p-1">
        {days.map((day) => {
          const onDay = occurrences.filter((occ) => occ.date === day)
          const open = onDay.filter((occ) => !occ.done).length
          const isSelected = day === selected
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${format(fromDateStr(day), 'EEEE, MMMM d')}: ${plural(open, 'open task')}`}
              onClick={() => onSelect(day)}
              className="relative flex flex-col items-center gap-1 rounded-md py-3 transition-colors hover:bg-raised/50"
            >
              {isSelected && (
                <motion.span
                  layoutId="week-strip-selected"
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-md border border-line-strong bg-raised shadow-card"
                />
              )}
              <span className="relative text-sm text-fg-muted">{format(fromDateStr(day), 'EEE')}</span>
              <span className={cx('tabular relative font-display text-lg', day === today && 'text-accent')}>
                {format(fromDateStr(day), 'd')}
              </span>
              <span className="relative flex h-1.5 gap-1" aria-hidden>
                {onDay.slice(0, 4).map((occ, index) => (
                  <span
                    key={occ.key}
                    className={cx('h-1.5 w-1.5 rounded-full', index < open ? 'bg-fg-muted' : 'bg-line-strong')}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function TaskList({ occs, hideDate }: { occs: Occurrence[]; hideDate?: boolean }) {
  return (
    <div className="grid gap-2">
      {occs.map((occ) => (
        <TaskRow key={occ.key} occ={occ} hideDate={hideDate} />
      ))}
    </div>
  )
}

export function TodayView() {
  const tasks = useTasksStore((state) => state.tasks)
  const today = todayStr()
  const [selected, setSelected] = useState(today)
  const [weekOffset, setWeekOffset] = useState(0)

  const thisWeekStart = toDateStr(startOfWeek(fromDateStr(today), WEEK_OPTIONS))
  const weekStart = shiftDate(thisWeekStart, weekOffset * 7)

  const { overdue, todays, week, upcoming, stats } = useMemo(() => {
    const all = listOccurrences(tasks, today)
    const weekEnd = shiftDate(today, 7)
    return {
      overdue: byDue(all.filter((occ) => isOverdue(occ, today))),
      todays: byDue(expandOccurrences(tasks, today, today)),
      week: expandOccurrences(tasks, weekStart, shiftDate(weekStart, 6)),
      upcoming: byDue(all.filter((occ) => occ.date !== null && occ.date > today && occ.date <= weekEnd && !occ.done)),
      stats: computeStats(tasks, today),
    }
  }, [tasks, today, weekStart])

  const selectedDay = selected === today ? todays : byDue(week.filter((occ) => occ.date === selected))
  const selectedLabel = selected === today ? 'Today' : friendlyDate(selected, today)

  const upcomingByDate = new Map<string, Occurrence[]>()
  for (const occ of upcoming) {
    if (occ.date) upcomingByDate.set(occ.date, [...(upcomingByDate.get(occ.date) ?? []), occ])
  }

  const shiftWeek = (weeks: number) => {
    const offset = weeks === 0 ? 0 : weekOffset + weeks
    setWeekOffset(offset)
    // Keep the selection inside the visible week: today for this week, otherwise its first day.
    setSelected(offset === 0 ? today : shiftDate(thisWeekStart, offset * 7))
  }

  return (
    <div className="grid gap-10">
      <Hero todays={todays} overdueCount={overdue.length} streak={stats.streak} doneThisWeek={stats.doneThisWeek} />

      <WeekStrip
        weekStart={weekStart}
        today={today}
        selected={selected}
        occurrences={week}
        onSelect={setSelected}
        onShift={shiftWeek}
      />

      {overdue.length > 0 && (
        <Section title="Overdue" count={overdue.length} tone="overdue">
          <TaskList occs={overdue} />
        </Section>
      )}

      <Section title={selectedLabel} count={selectedDay.length}>
        <div className="grid gap-3">
          <QuickAdd dueDate={selected} label={selected === today ? 'Add a task for today' : `Add a task for ${selectedLabel}`} />
          {selectedDay.length === 0 ? (
            <div className="rounded-lg border border-line bg-raised shadow-card">
              <EmptyState
                icon={Sparkles}
                title={selected === today ? 'Nothing due today' : `Nothing planned for ${selectedLabel}`}
                description="Enjoy the space, or add something above."
              />
            </div>
          ) : (
            <TaskList occs={selectedDay} hideDate />
          )}
        </div>
      </Section>

      {selected === today && (
        <Section title="Next 7 days" count={upcoming.length}>
          {upcoming.length === 0 ? (
            <p className="text-base text-fg-muted">Nothing scheduled for the coming week.</p>
          ) : (
            <div className="grid gap-6">
              {[...upcomingByDate.entries()].map(([date, occs]) => (
                <div key={date}>
                  <h3 className="mb-2 text-base font-medium text-fg-muted">{friendlyDate(date, today)}</h3>
                  <TaskList occs={occs} hideDate />
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  )
}
