import { format } from 'date-fns'
import { ChartColumn, CheckCheck, Gauge, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CategoryDot } from '@/components/task/TaskBits'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Segmented } from '@/components/ui/fields'
import { completionsByCategory } from '@/lib/analytics'
import { cx } from '@/lib/cx'
import { fromDateStr, todayStr } from '@/lib/dates'
import { PALETTE } from '@/lib/palette'
import { categoryFor } from '@/lib/tasks'
import { useTasksStore } from '@/store/tasks'

const RANGES = [
  { value: '4', label: '4 weeks' },
  { value: '8', label: '8 weeks' },
  { value: '12', label: '12 weeks' },
] as const

type Range = (typeof RANGES)[number]['value']

function Card({ icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-raised px-4 py-3 shadow-card">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon icon={icon} />
      </span>
      <div className="min-w-0">
        <div className="tabular truncate font-display text-xl leading-none">{value}</div>
        <div className="mt-1 text-sm text-fg-muted">{label}</div>
      </div>
    </div>
  )
}

function weekLabel(start: string, isCurrent: boolean): string {
  return isCurrent ? 'This week' : format(fromDateStr(start), 'MMM d')
}

export function InsightsView() {
  const tasks = useTasksStore((state) => state.tasks)
  const categories = useTasksStore((state) => state.categories)
  const [range, setRange] = useState<Range>('8')
  const today = todayStr()

  const data = useMemo(
    () => completionsByCategory(tasks, categories, today, Number(range)),
    [tasks, categories, today, range],
  )
  const average = data.total / data.weeks.length
  const top = data.categories[0]

  // Gridlines at 0, half and the tallest bar.
  const ticks = [data.max, Math.round(data.max / 2), 0].filter((tick, index, all) => all.indexOf(tick) === index)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-fg-muted">Tasks you completed, by category and week.</p>
        <Segmented ariaLabel="Time range" options={[...RANGES]} value={range} onChange={setRange} />
      </div>

      {data.total === 0 ? (
        <div className="rounded-lg border border-line bg-raised shadow-card">
          <EmptyState
            icon={ChartColumn}
            title="Nothing to chart yet"
            description={`Complete a few tasks and your last ${range} weeks will show up here.`}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card icon={CheckCheck} value={String(data.total)} label={`Completed in ${range} weeks`} />
            <Card icon={Gauge} value={average.toFixed(1)} label="Average per week" />
            <Card icon={Trophy} value={top?.category.name ?? '–'} label="Most completed category" />
          </div>

          <section
            aria-label="Completed tasks per week"
            className="rounded-lg border border-line bg-raised p-4 shadow-card"
          >
            <div className="flex gap-3">
              <div className="tabular relative hidden h-56 w-6 shrink-0 text-right text-xs text-fg-subtle sm:block" aria-hidden="true">
                {ticks.map((tick) => (
                  <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (tick / data.max) * 100}%` }}>
                    {tick}
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="relative h-56">
                  {ticks.map((tick) => (
                    <div
                      key={tick}
                      aria-hidden="true"
                      className="absolute inset-x-0 border-t border-dashed border-line"
                      style={{ top: `${100 - (tick / data.max) * 100}%` }}
                    />
                  ))}
                  <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-3">
                    {data.weeks.map((week, index) => (
                      <div
                        key={week.start}
                        className="flex h-full min-w-0 flex-1 flex-col justify-end"
                        title={`${weekLabel(week.start, index === data.weeks.length - 1)}: ${week.total} completed`}
                      >
                        <div
                          className="flex flex-col-reverse overflow-hidden rounded-t-sm transition-[height] duration-200"
                          style={{ height: `${(week.total / data.max) * 100}%` }}
                        >
                          {data.categories.map(({ category }) => {
                            const count = week.counts[category.id] ?? 0
                            return count > 0 ? (
                              <div
                                key={category.id}
                                className={cx('border-t border-raised', PALETTE[category.colorKey].solid)}
                                style={{ height: `${(count / week.total) * 100}%` }}
                              />
                            ) : null
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5 sm:gap-3" aria-hidden="true">
                  {data.weeks.map((week, index) => (
                    <div key={week.start} className="min-w-0 flex-1 truncate text-center text-xs text-fg-muted">
                      {weekLabel(week.start, index === data.weeks.length - 1)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3" aria-label="Legend">
              {data.categories.map(({ category, total }) => (
                <li key={category.id} className="flex items-center gap-2 text-sm">
                  <CategoryDot color={category.colorKey} />
                  {category.name}
                  <span className="tabular text-fg-subtle">{total}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Data table" className="overflow-x-auto rounded-lg border border-line bg-raised shadow-card">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">Completed tasks by category and week</caption>
              <thead className="border-b border-line bg-panel text-fg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Category
                  </th>
                  {data.weeks.map((week, index) => (
                    <th key={week.start} scope="col" className="tabular px-3 py-2 text-right font-medium">
                      {weekLabel(week.start, index === data.weeks.length - 1)}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map(({ category, total }) => (
                  <tr key={category.id} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-3 py-2 font-normal">
                      <span className="inline-flex items-center gap-2">
                        <CategoryDot color={categoryFor(category.id, categories).colorKey} />
                        {category.name}
                      </span>
                    </th>
                    {data.weeks.map((week) => (
                      <td key={week.start} className="tabular px-3 py-2 text-right text-fg-muted">
                        {week.counts[category.id] ?? 0}
                      </td>
                    ))}
                    <td className="tabular px-3 py-2 text-right font-medium">{total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}
