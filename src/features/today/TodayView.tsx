import { format, startOfWeek } from 'date-fns'
import { motion } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, ChevronDown, Clock, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { QuickAdd } from '@/components/task/QuickAdd'
import { SortableTaskList, TaskRow } from '@/components/task/TaskRow'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { useTaskActions } from '@/hooks/useTaskActions'
import { cx } from '@/lib/cx'
import { WEEK_OPTIONS, formatTime, friendlyDate, fromDateStr, greetingFor, shiftDate, toDateStr, todayStr } from '@/lib/dates'
import { readStored, writeStored } from '@/lib/persist'
import { compareByDue, compareByOrder, expandOccurrences, isOverdue, listOccurrences } from '@/lib/recurrence'
import { computeStats } from '@/lib/stats'
import { categoryFor } from '@/lib/tasks'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import type { Occurrence } from '@/types/model'
import { Focus } from './Focus'
import { Schedule } from './Schedule'
import { StreakButton } from './StreakButton'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
const byDue = (list: Occurrence[]) => [...list].sort(compareByDue)
const byOrder = (list: Occurrence[]) => [...list].sort(compareByOrder)
const OVERDUE_OPEN_KEY = 'daybook:overdue-open'
const pinnableRow = (occ: Occurrence, handle: ReactNode) => <TaskRow occ={occ} hideDate dragHandle={handle} pinnable />

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
        {title}
        {count !== undefined && <span className="tabular font-medium text-fg-subtle">{count}</span>}
      </h2>
      {children}
    </section>
  )
}

/** A small ring in the highlight color: how much of today is done. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 6
  const c = 2 * Math.PI * r
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="-rotate-90">
      <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2.5" className="stroke-line" />
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="stroke-highlight transition-[stroke-dashoffset] duration-200"
        strokeDasharray={c}
        strokeDashoffset={total === 0 ? c : c * (1 - done / total)}
      />
    </svg>
  )
}

function NextUp({ occ }: { occ: Occurrence }) {
  const categories = useTasksStore((state) => state.categories)
  const { setDone } = useTaskActions()
  const category = categoryFor(occ.task.categoryId, categories)
  return (
    <section aria-label="Next up" className="flex items-center gap-4 rounded-lg border border-line bg-raised px-5 py-4 shadow-card">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg-muted">Next up{occ.task.dueTime ? ` · ${formatTime(occ.task.dueTime)}` : ''}</p>
        <p className="truncate font-display text-lg">{occ.task.title}</p>
        <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-fg-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: `rgb(var(--cat-${category.colorKey}))` }} />
          {category.name}
        </p>
      </div>
      <Button variant="secondary" size="sm" icon={Check} onClick={() => void setDone(occ, true)}>
        Mark done
      </Button>
    </section>
  )
}

/** Only rendered when something is overdue; collapses and remembers that choice. */
function OverdueDropdown({ overdue }: { overdue: Occurrence[] }) {
  const [open, setOpen] = useState(() => readStored(OVERDUE_OPEN_KEY) !== 'false')
  const toggle = () => {
    writeStored(OVERDUE_OPEN_KEY, String(!open))
    setOpen(!open)
  }
  return (
    <section aria-label="Overdue">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="mb-3 flex w-full items-center gap-2 rounded-md text-sm font-semibold uppercase tracking-wide text-fg"
      >
        <Icon icon={Clock} size={16} />
        Overdue
        <span className="tabular font-medium text-fg-subtle">{overdue.length}</span>
        <Icon icon={ChevronDown} size={16} className={cx('ml-auto text-fg-muted transition-transform duration-200', !open && '-rotate-90')} />
      </button>
      {open && <TaskList occs={overdue} />}
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
      <div className="grid grid-cols-7 gap-1 rounded-lg border border-line bg-panel p-1">
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
              className="relative flex flex-col items-center gap-1 rounded-md py-3 transition-colors hover:bg-sunken"
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
  const personal = useUiStore((state) => state.personal)
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

  const isToday = selected === today
  // Day lists follow "My order"; Next up, Overdue and the schedule stay in time order.
  const selectedDay = byOrder(isToday ? todays : week.filter((occ) => occ.date === selected))
  const selectedLabel = isToday ? 'Tasks' : friendlyDate(selected, today)
  const doneToday = todays.filter((occ) => occ.done).length
  const focused = byOrder(todays.filter((occ) => occ.task.focusDate === today))
  const nowTime = format(new Date(), 'HH:mm')
  const open = todays.filter((occ) => !occ.done)
  const next = open.find((occ) => occ.task.dueTime !== null && occ.task.dueTime >= nowTime) ?? open[0]

  const upcomingByDate = new Map<string, Occurrence[]>()
  for (const occ of upcoming) {
    if (occ.date) upcomingByDate.set(occ.date, [...(upcomingByDate.get(occ.date) ?? []), occ])
  }
  for (const [date, occs] of upcomingByDate) upcomingByDate.set(date, byOrder(occs))

  const shiftWeek = (weeks: number) => {
    const offset = weeks === 0 ? 0 : weekOffset + weeks
    setWeekOffset(offset)
    // Keep the selection inside the visible week: today for this week, otherwise its first day.
    setSelected(offset === 0 ? today : shiftDate(thisWeekStart, offset * 7))
  }

  return (
    <div className="grid gap-8">
      <section aria-label="Today at a glance">
        <h2 className="font-display text-xl">{greetingFor(new Date().getHours(), personal.name)}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-fg-muted">
          <span className="inline-flex items-center gap-2">
            <ProgressRing done={doneToday} total={todays.length} />
            <span>
              <b className="font-semibold text-fg">{doneToday} of {todays.length}</b> done today
            </span>
          </span>
          <StreakButton />
          <span>
            <b className="font-semibold text-fg">{stats.doneThisWeek}</b> done this week
          </span>
        </div>
      </section>

      <WeekStrip
        weekStart={weekStart}
        today={today}
        selected={selected}
        occurrences={week}
        onSelect={setSelected}
        onShift={shiftWeek}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid gap-8">
          {personal.showNextUp && isToday && next && <NextUp occ={next} />}
          {isToday && <Focus occs={focused} />}

          <Section title={selectedLabel} count={selectedDay.length}>
            <div className="grid gap-3">
              <QuickAdd dueDate={selected} label={isToday ? 'Add a task for today' : `Add a task for ${selectedLabel}`} />
              {selectedDay.length === 0 ? (
                <div className="rounded-lg border border-line bg-raised shadow-card">
                  <EmptyState
                    icon={Sparkles}
                    title={isToday ? 'Nothing due today' : `Nothing planned for ${selectedLabel}`}
                    description="Enjoy the space, or add something above."
                  />
                </div>
              ) : (
                <SortableTaskList occs={selectedDay} render={isToday ? pinnableRow : undefined} />
              )}
            </div>
          </Section>

          {personal.showUpcoming && isToday && (
            <Section title="Next 7 days" count={upcoming.length}>
              {upcoming.length === 0 ? (
                <p className="text-base text-fg-muted">Nothing scheduled for the coming week.</p>
              ) : (
                <div className="grid gap-6">
                  {[...upcomingByDate.entries()].map(([date, occs]) => (
                    <div key={date}>
                      <h3 className="mb-2 text-base font-medium text-fg-muted">{friendlyDate(date, today)}</h3>
                      <SortableTaskList occs={occs} />
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}
        </div>

        <div className="grid gap-8">
          {overdue.length > 0 && <OverdueDropdown overdue={overdue} />}
          {personal.showSchedule && <Schedule date={selected} occs={selectedDay} />}
        </div>
      </div>
    </div>
  )
}
