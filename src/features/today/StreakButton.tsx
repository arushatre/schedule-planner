import { format, startOfWeek } from 'date-fns'
import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

import { Dialog } from '@/components/ui/Dialog'
import { activeDays, activityByDay, currentRun, streakRuns, streakTier } from '@/lib/activity'
import type { StreakRun } from '@/lib/activity'
import { cx } from '@/lib/cx'
import { WEEK_OPTIONS, friendlyDate, fromDateStr, shiftDate, toDateStr, todayStr } from '@/lib/dates'
import { useTasksStore } from '@/store/tasks'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
const day = (date: string) => format(fromDateStr(date), 'EEE, MMM d')
const span = (run: StreakRun) => (run.days === 1 ? day(run.start) : `${day(run.start)} – ${day(run.end)}`)

/** Spark offsets (px) for the hover fireworks: two tiny bursts, above-left and above-right. */
const SPARKS = [
  [-10, -14], [0, -18], [10, -14], [-14, -4], [14, -4],
  [-8, -10], [8, -10], [0, -8],
] as const

/** The 🔥 streak in Today's stats line. It warms up as the streak grows; click for the history. */
export function StreakButton() {
  const tasks = useTasksStore((state) => state.tasks)
  const events = useTasksStore((state) => state.activity)
  const [open, setOpen] = useState(false)
  const today = todayStr()
  const runs = useMemo(() => streakRuns(activeDays(events, tasks)), [events, tasks])
  const current = currentRun(runs, today)?.days ?? 0
  const tier = streakTier(current)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx('streak relative inline-flex items-center gap-1.5 rounded-md px-1 py-0.5', `streak-t${tier}`)}
        aria-label={`${current > 0 ? `${current}-day streak` : 'No streak yet'}. Show streak history.`}
      >
        <span aria-hidden className="streak-fire">🔥</span>
        <span className="streak-text">
          {current > 0 ? (
            <>
              <b className="font-semibold">{current}</b>-day streak
            </>
          ) : (
            'Start a streak today'
          )}
        </span>
        {tier === 4 && <span className="streak-tag">On fire</span>}
        {tier >= 3 && (
          <span aria-hidden className="streak-fireworks">
            {SPARKS.map(([dx, dy], index) => (
              <i key={index} style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${(index % 2) * 120}ms` } as CSSProperties} />
            ))}
          </span>
        )}
      </button>
      <StreakHistory open={open} onClose={() => setOpen(false)} runs={runs} today={today} />
    </>
  )
}

function StreakHistory({ open, onClose, runs, today }: { open: boolean; onClose: () => void; runs: StreakRun[]; today: string }) {
  const tasks = useTasksStore((state) => state.tasks)
  const events = useTasksStore((state) => state.activity)
  const byDay = useMemo(() => activityByDay(events), [events])
  const days = useMemo(() => activeDays(events, tasks), [events, tasks])
  const current = currentRun(runs, today)
  const longest = runs.reduce((max, run) => Math.max(max, run.days), 0)
  // Five calendar weeks ending with this one, so columns line up with weekdays.
  const gridStart = shiftDate(toDateStr(startOfWeek(fromDateStr(today), WEEK_OPTIONS)), -28)
  const grid = Array.from({ length: 35 }, (_, index) => shiftDate(gridStart, index))
  const recent = [...days].sort().reverse().slice(0, 14)

  return (
    <Dialog open={open} onClose={onClose} title="Streak history">
      <div className="grid gap-6">
        <dl className="grid grid-cols-3 gap-3">
          {[
            ['Current', current ? plural(current.days, 'day') : '—'],
            ['Longest', longest ? plural(longest, 'day') : '—'],
            ['Active days', String(days.size)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-line bg-panel px-3 py-2">
              <dt className="text-xs text-fg-muted">{label}</dt>
              <dd className="tabular font-display text-lg">{value}</dd>
            </div>
          ))}
        </dl>

        <section aria-label="Last five weeks">
          <h3 className="mb-2 text-sm font-semibold text-fg-muted">Last 5 weeks</h3>
          <div className="grid w-max grid-cols-7 gap-1">
            {grid.slice(0, 7).map((date) => (
              <span key={`label-${date}`} className="text-center text-xs text-fg-subtle">
                {format(fromDateStr(date), 'EEEEE')}
              </span>
            ))}
            {grid.map((date) => (
              <span
                key={date}
                title={`${day(date)}: ${days.has(date) ? 'active' : 'no activity'}`}
                className={cx(
                  'h-5 w-7 rounded-sm',
                  days.has(date) ? 'bg-ember/70' : 'bg-sunken',
                  date > today && 'opacity-40',
                  date === today && 'ring-1 ring-fg-muted',
                )}
              />
            ))}
          </div>
        </section>

        <section aria-label="Streaks">
          <h3 className="mb-2 text-sm font-semibold text-fg-muted">Streaks</h3>
          {runs.length === 0 ? (
            <p className="text-base text-fg-muted">No streaks yet. Add or finish a task to start one.</p>
          ) : (
            <ol className="grid gap-2">
              {[...runs].reverse().slice(0, 12).map((run) => {
                const isCurrent = run === current
                const verb = run.gapBefore === null ? 'Started' : `Restarted after ${plural(run.gapBefore, 'day')} off`
                return (
                  <li key={run.start} className="flex items-baseline justify-between gap-3 rounded-md border border-line px-3 py-2">
                    <span>
                      <span className="block text-base">{isCurrent ? 'Current streak' : `Ended ${day(run.end)}`}</span>
                      <span className="text-sm text-fg-muted">
                        {verb} · {span(run)}
                      </span>
                    </span>
                    <span className="tabular shrink-0 font-semibold">{plural(run.days, 'day')}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <section aria-label="When you used Daybook">
          <h3 className="mb-2 text-sm font-semibold text-fg-muted">When you used Daybook</h3>
          <ul className="grid gap-1.5">
            {recent.map((date) => {
              const times = byDay.get(date) ?? []
              return (
                <li key={date} className="flex justify-between gap-4 text-sm">
                  <span className="shrink-0 font-medium">{friendlyDate(date, today)}</span>
                  <span className="tabular truncate text-right text-fg-muted">
                    {times.length === 0
                      ? 'Finished tasks'
                      : times.length > 5
                        ? `${format(times[0]!, 'h:mm a')} – ${format(times[times.length - 1]!, 'h:mm a')} · ${times.length} times`
                        : times.map((at) => format(at, 'h:mm a')).join(', ')}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </Dialog>
  )
}
