import { CalendarClock, CheckCheck, ListChecks, ListFilter, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { CategoryDot } from '@/components/task/TaskBits'
import { TaskRow } from '@/components/task/TaskRow'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
import { Pill, Segmented, TextInput } from '@/components/ui/fields'
import { useTaskActions } from '@/hooks/useTaskActions'
import { friendlyDate, todayStr } from '@/lib/dates'
import { activeFilterCount, applyFilters, groupOccurrences, sortOccurrences } from '@/lib/filters'
import type { GroupKey, SortKey } from '@/lib/filters'
import { listOccurrences } from '@/lib/recurrence'
import { categoryFor } from '@/lib/tasks'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import type { ListMode } from '@/store/ui'
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from '@/types/model'
import { Board } from './Board'

const MODE_OPTIONS: { value: ListMode; label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
]

const GROUP_OPTIONS: SelectOption<GroupKey>[] = [
  { value: 'date', label: 'Group by date' },
  { value: 'category', label: 'Group by category' },
  { value: 'priority', label: 'Group by priority' },
  { value: 'none', label: 'No grouping' },
]

const SORT_OPTIONS: SelectOption<SortKey>[] = [
  { value: 'due', label: 'Sort by due date' },
  { value: 'priority', label: 'Sort by priority' },
  { value: 'created', label: 'Sort by newest' },
]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function ListView() {
  const tasks = useTasksStore((state) => state.tasks)
  const categories = useTasksStore((state) => state.categories)
  const { filters, sort, group, listMode, setListMode, setFilters, clearFilters, setSort, setGroup, openEditor } =
    useUiStore()
  const board = listMode === 'board'
  const searchFocusRequested = useUiStore((state) => state.searchFocusRequested)
  const consumeSearchFocus = useUiStore((state) => state.consumeSearchFocus)
  const { completeMany, moveMany, remove } = useTaskActions()

  const [panelOpen, setPanelOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveDate, setMoveDate] = useState<string | null>(todayStr())

  useEffect(() => {
    if (!searchFocusRequested) return
    document.querySelector<HTMLInputElement>('input[aria-label="Search tasks"]')?.focus()
    consumeSearchFocus()
  }, [searchFocusRequested, consumeSearchFocus])

  const today = todayStr()
  const all = useMemo(() => listOccurrences(tasks, today), [tasks, today])
  const visible = useMemo(
    () => sortOccurrences(applyFilters(all, filters), sort),
    [all, filters, sort],
  )
  const groups = useMemo(
    () => groupOccurrences(visible, group, { categories, today }),
    [visible, group, categories, today],
  )
  const allTags = useMemo(() => [...new Set(tasks.flatMap((task) => task.tags))].sort(), [tasks])
  const activeCount = activeFilterCount(filters)
  const chosen = visible.filter((occ) => selected.has(occ.key))

  const exitSelect = () => {
    setSelecting(false)
    setSelected(new Set())
  }

  const activeCategories = categories.filter((category) => !category.archived)

  return (
    <div className="grid gap-4">
      <Segmented
        ariaLabel="Layout"
        options={MODE_OPTIONS}
        value={listMode}
        onChange={(mode) => {
          exitSelect()
          setListMode(mode)
        }}
        className="justify-self-start"
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Icon icon={Search} size={16} className="pointer-events-none absolute left-3 top-3 text-fg-subtle" />
          <TextInput
            aria-label="Search tasks"
            placeholder="Search title, notes, tags…"
            value={filters.query}
            onChange={(event) => setFilters({ query: event.target.value })}
            className="pl-9"
          />
        </div>
        <Button
          icon={ListFilter}
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen(!panelOpen)}
          variant={panelOpen ? 'primary' : 'secondary'}
        >
          Filters{activeCount > 0 ? ` · ${activeCount}` : ''}
        </Button>
        {!board && (
          <Select ariaLabel="Group" options={GROUP_OPTIONS} value={group} onChange={setGroup} className="w-44" />
        )}
        <Select ariaLabel="Sort" options={SORT_OPTIONS} value={sort} onChange={setSort} className="w-44" />
        {!board && (
          <Button
            icon={CheckCheck}
            variant={selecting ? 'primary' : 'secondary'}
            onClick={() => (selecting ? exitSelect() : setSelecting(true))}
          >
            {selecting ? 'Done' : 'Select'}
          </Button>
        )}
      </div>

      {panelOpen && (
        <section
          aria-label="Filters"
          className="grid gap-4 rounded-lg border border-line bg-panel p-4 shadow-card"
        >
          <FilterRow label="Category">
            {activeCategories.map((category) => (
              <Pill
                key={category.id}
                pressed={filters.categoryIds.includes(category.id)}
                onClick={() => setFilters({ categoryIds: toggle(filters.categoryIds, category.id) })}
              >
                <CategoryDot color={category.colorKey} />
                {category.name}
              </Pill>
            ))}
          </FilterRow>
          <FilterRow label="Priority">
            {PRIORITIES.map((priority) => (
              <Pill
                key={priority}
                pressed={filters.priorities.includes(priority)}
                onClick={() => setFilters({ priorities: toggle(filters.priorities, priority) })}
              >
                {PRIORITY_LABEL[priority]}
              </Pill>
            ))}
          </FilterRow>
          <FilterRow label="Status">
            {STATUSES.map((status) => (
              <Pill
                key={status}
                pressed={filters.statuses.includes(status)}
                onClick={() => setFilters({ statuses: toggle(filters.statuses, status) })}
              >
                {STATUS_LABEL[status]}
              </Pill>
            ))}
          </FilterRow>
          {allTags.length > 0 && (
            <FilterRow label="Tag">
              {allTags.map((tag) => (
                <Pill
                  key={tag}
                  pressed={filters.tags.includes(tag)}
                  onClick={() => setFilters({ tags: toggle(filters.tags, tag) })}
                >
                  #{tag}
                </Pill>
              ))}
            </FilterRow>
          )}
          <FilterRow label="Date range">
            <DatePicker ariaLabel="From date" value={filters.from} onChange={(from) => setFilters({ from })} placeholder="From" className="w-52" />
            <DatePicker ariaLabel="To date" value={filters.to} onChange={(to) => setFilters({ to })} placeholder="To" className="w-52" />
          </FilterRow>
        </section>
      )}

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {filters.categoryIds.map((id) => (
            <ActivePill key={id} onClear={() => setFilters({ categoryIds: filters.categoryIds.filter((value) => value !== id) })}>
              <CategoryDot color={categoryFor(id, categories).colorKey} />
              {categoryFor(id, categories).name}
            </ActivePill>
          ))}
          {filters.priorities.map((value) => (
            <ActivePill key={value} onClear={() => setFilters({ priorities: filters.priorities.filter((item) => item !== value) })}>
              {PRIORITY_LABEL[value]} priority
            </ActivePill>
          ))}
          {filters.statuses.map((value) => (
            <ActivePill key={value} onClear={() => setFilters({ statuses: filters.statuses.filter((item) => item !== value) })}>
              {STATUS_LABEL[value]}
            </ActivePill>
          ))}
          {filters.tags.map((value) => (
            <ActivePill key={value} onClear={() => setFilters({ tags: filters.tags.filter((item) => item !== value) })}>
              #{value}
            </ActivePill>
          ))}
          {(filters.from || filters.to) && (
            <ActivePill onClear={() => setFilters({ from: null, to: null })}>
              {filters.from ? friendlyDate(filters.from) : 'Any'} → {filters.to ? friendlyDate(filters.to) : 'Any'}
            </ActivePill>
          )}
          {filters.query.trim() && (
            <ActivePill onClear={() => setFilters({ query: '' })}>“{filters.query.trim()}”</ActivePill>
          )}
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      )}

      {selecting && !board && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 shadow-lift">
          <span className="mr-auto text-base font-medium text-accent">{selected.size} selected</span>
          <Button
            size="sm"
            onClick={() => setSelected(new Set(visible.map((occ) => occ.key)))}
            disabled={visible.length === 0}
          >
            Select all
          </Button>
          <Button
            size="sm"
            icon={CheckCheck}
            disabled={chosen.length === 0}
            onClick={() => {
              void completeMany(chosen)
              exitSelect()
            }}
          >
            Complete
          </Button>
          <Button size="sm" icon={CalendarClock} disabled={chosen.length === 0} onClick={() => setMoveOpen(true)}>
            Reschedule
          </Button>
          <Button
            size="sm"
            icon={Trash2}
            disabled={chosen.length === 0}
            onClick={() => {
              void remove(chosen.map((occ) => occ.task.id))
              exitSelect()
            }}
          >
            Delete
          </Button>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-line bg-raised shadow-card">
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            description="Add your first task and it will show up here and on the calendar."
            action={
              <Button variant="primary" icon={Plus} onClick={() => openEditor({ mode: 'new', dueDate: null })}>
                New task
              </Button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-line bg-raised shadow-card">
          <EmptyState
            icon={Search}
            title="Nothing matches"
            description="No tasks fit the current search and filters."
            action={<Button onClick={clearFilters}>Clear filters</Button>}
          />
        </div>
      ) : board ? (
        <Board occurrences={visible} />
      ) : (
        <div className="grid gap-6">
          {groups.map((bucket) => (
            <section key={bucket.key} aria-label={bucket.label || 'Tasks'}>
              {bucket.label && (
                <h2 className="mb-2 flex items-baseline gap-2 font-display text-md">
                  {bucket.label}
                  <span className="tabular font-sans text-sm text-fg-subtle">{bucket.occurrences.length}</span>
                </h2>
              )}
              <div className="grid gap-2">
                {bucket.occurrences.map((occ) => (
                  <TaskRow
                    key={occ.key}
                    occ={occ}
                    hideDate={group === 'date'}
                    selectable={selecting}
                    selected={selected.has(occ.key)}
                    onSelect={(value) =>
                      setSelected((current) => {
                        const next = new Set(current)
                        if (value) next.add(occ.key)
                        else next.delete(occ.key)
                        return next
                      })
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={`Reschedule ${chosen.length} ${chosen.length === 1 ? 'task' : 'tasks'}`}
        footer={
          <>
            <Button onClick={() => setMoveOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!moveDate}
              onClick={() => {
                if (!moveDate) return
                void moveMany(chosen, moveDate)
                setMoveOpen(false)
                exitSelect()
              }}
            >
              Move
            </Button>
          </>
        }
      >
        <div className="min-h-[22rem]">
          <DatePicker ariaLabel="New date" value={moveDate} onChange={setMoveDate} clearable={false} />
        </div>
      </Dialog>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[6rem_1fr] sm:items-center">
      <span className="text-sm font-medium text-fg-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function ActivePill({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft py-0.5 pl-2.5 pr-1 text-sm text-accent">
      {children}
      <button
        type="button"
        aria-label="Clear filter"
        onClick={onClear}
        className="rounded-full p-0.5 transition-colors hover:bg-accent/15"
      >
        <Icon icon={X} size={14} />
      </button>
    </span>
  )
}
