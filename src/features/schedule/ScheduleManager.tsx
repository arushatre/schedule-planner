import { GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Swatches } from '@/components/task/Swatches'
import { CategoryDot } from '@/components/task/TaskBits'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
import { Field, Pill, TextInput } from '@/components/ui/fields'
import { useTaskActions } from '@/hooks/useTaskActions'
import { TIME_SLOTS, formatTime } from '@/lib/dates'
import type { PaletteKey } from '@/lib/palette'
import { formatBlockTimes, formatWeekdays, isValidBlockTimes } from '@/lib/schedule'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import type { ClassBlock } from '@/types/model'

const WEEKDAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
]

const TIME_OPTIONS: SelectOption[] = TIME_SLOTS.map((slot) => ({ value: slot, label: formatTime(slot) }))

interface Draft {
  id: string | null
  title: string
  location: string
  weekdays: number[]
  startTime: string
  endTime: string
  colorKey: PaletteKey
}

const blank = (): Draft => ({
  id: null,
  title: '',
  location: '',
  weekdays: [1, 3, 5],
  startTime: '09:00',
  endTime: '09:50',
  colorKey: 'plum',
})

function BlockForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const saveClassBlock = useTasksStore((state) => state.saveClassBlock)
  const { guard } = useTaskActions()
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<{ title?: string; days?: string; times?: string }>({})

  const patch = (partial: Partial<Draft>) => setDraft((current) => ({ ...current, ...partial }))

  const submit = () => {
    const next: typeof errors = {}
    if (!draft.title.trim()) next.title = 'Name this class.'
    if (draft.weekdays.length === 0) next.days = 'Pick at least one day.'
    if (!isValidBlockTimes(draft.startTime, draft.endTime)) next.times = 'The class must end after it starts.'
    setErrors(next)
    if (Object.keys(next).length) return

    void guard(async () => {
      await saveClassBlock({
        id: draft.id ?? crypto.randomUUID(),
        title: draft.title.trim(),
        location: draft.location.trim(),
        weekdays: draft.weekdays,
        startTime: draft.startTime,
        endTime: draft.endTime,
        colorKey: draft.colorKey,
        createdAt: Date.now(),
      })
      onDone()
    })
  }

  return (
    <form
      className="grid gap-4 rounded-md border border-line-strong bg-panel p-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Class" error={errors.title}>
          <TextInput
            data-autofocus
            aria-label="Class name"
            placeholder="Math"
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Field>
        <Field label="Location (optional)">
          <TextInput
            aria-label="Location"
            placeholder="Room 204"
            value={draft.location}
            onChange={(event) => patch({ location: event.target.value })}
          />
        </Field>
      </div>

      <Field label="Meets on" error={errors.days}>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Meets on">
          {WEEKDAYS.map(({ day, label }) => (
            <Pill
              key={day}
              pressed={draft.weekdays.includes(day)}
              onClick={() =>
                patch({
                  weekdays: draft.weekdays.includes(day)
                    ? draft.weekdays.filter((existing) => existing !== day)
                    : [...draft.weekdays, day],
                })
              }
            >
              {label}
            </Pill>
          ))}
        </div>
      </Field>

      <Field label="Time" error={errors.times}>
        <div className="flex items-center gap-2">
          <Select ariaLabel="Start time" options={TIME_OPTIONS} value={draft.startTime} onChange={(startTime) => patch({ startTime })} className="w-36" />
          <span className="text-fg-muted">to</span>
          <Select ariaLabel="End time" options={TIME_OPTIONS} value={draft.endTime} onChange={(endTime) => patch({ endTime })} className="w-36" />
        </div>
      </Field>

      <Field label="Color">
        <Swatches value={draft.colorKey} onChange={(colorKey) => patch({ colorKey })} />
      </Field>

      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary">
          {draft.id ? 'Save class' : 'Add class'}
        </Button>
      </div>
    </form>
  )
}

export function ScheduleManager() {
  const open = useUiStore((state) => state.dialog === 'schedule')
  const openDialog = useUiStore((state) => state.openDialog)
  const pushToast = useUiStore((state) => state.pushToast)
  const blocks = useTasksStore((state) => state.classBlocks)
  const deleteClassBlock = useTasksStore((state) => state.deleteClassBlock)
  const { guard } = useTaskActions()
  const [editing, setEditing] = useState<Draft | null>(null)

  const close = () => {
    setEditing(null)
    openDialog(null)
  }

  const edit = (block: ClassBlock) => setEditing({ ...block })

  const remove = (block: ClassBlock) =>
    void guard(async () => {
      const undo = await deleteClassBlock(block.id)
      pushToast({ message: `Removed “${block.title}”`, actionLabel: 'Undo', onAction: () => void undo() })
    })

  return (
    <Dialog open={open} onClose={close} title="Class schedule" size="lg">
      <div className="grid gap-4">
        <p className="text-sm text-fg-muted">
          Fixed weekly blocks, like “Math, Mon/Wed/Fri 9:00–9:50”. They show on the calendar as dashed
          outlines so they never get mistaken for tasks.
        </p>

        {blocks.length === 0 && !editing && (
          <div className="rounded-md border border-dashed border-line-strong">
            <EmptyState icon={GraduationCap} title="No classes yet" description="Add your weekly schedule to see it alongside your tasks." />
          </div>
        )}

        <ul className="grid gap-2">
          {[...blocks]
            .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title))
            .map((block) => (
              <li
                key={block.id}
                className="flex items-center gap-3 rounded-md border border-line bg-raised px-3 py-2.5"
              >
                <CategoryDot color={block.colorKey} className="h-3 w-3" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base">{block.title}</div>
                  <div className="tabular truncate text-sm text-fg-muted">
                    {formatWeekdays(block.weekdays)} · {formatBlockTimes(block)}
                    {block.location ? ` · ${block.location}` : ''}
                  </div>
                </div>
                <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${block.title}`} onClick={() => edit(block)} />
                <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${block.title}`} onClick={() => remove(block)} />
              </li>
            ))}
        </ul>

        {editing ? (
          <BlockForm key={editing.id ?? 'new'} initial={editing} onDone={() => setEditing(null)} />
        ) : (
          <div>
            <Button icon={Plus} variant="primary" onClick={() => setEditing(blank())}>
              Add a class
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  )
}
