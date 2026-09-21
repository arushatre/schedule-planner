import { Plus, Trash2, X } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { DatePicker } from '@/components/ui/DatePicker'
import { Dialog } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
import { Field, Pill, Segmented, TagInput, TextArea, TextInput } from '@/components/ui/fields'
import { useTaskActions } from '@/hooks/useTaskActions'
import { TIME_SLOTS, formatTime } from '@/lib/dates'
import { makeTask } from '@/lib/tasks'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import { PRIORITIES, PRIORITY_LABEL, RECURRENCE_KINDS, RECURRENCE_LABEL, STATUSES, STATUS_LABEL } from '@/types/model'
import type { Priority, Recurrence, RecurrenceKind, Status, Subtask, Task } from '@/types/model'

const WEEKDAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
]

const timeOptions = (emptyLabel: string): SelectOption[] => [
  { value: '', label: emptyLabel },
  ...TIME_SLOTS.map((slot) => ({ value: slot, label: formatTime(slot) })),
]

const DUE_TIME_OPTIONS = timeOptions('No time')
const REMINDER_OPTIONS = timeOptions('No reminder')

interface FormState {
  title: string
  notes: string
  dueDate: string | null
  dueTime: string
  categoryId: string
  tags: string[]
  priority: Priority
  status: Status
  subtasks: Subtask[]
  recurrence: Recurrence
  reminderTime: string
}

function initialState(task: Task | null, defaults: { dueDate: string | null; categoryId: string }): FormState {
  return {
    title: task?.title ?? '',
    notes: task?.notes ?? '',
    dueDate: task ? task.dueDate : defaults.dueDate,
    dueTime: task?.dueTime ?? '',
    categoryId: task?.categoryId ?? defaults.categoryId,
    tags: task?.tags ?? [],
    priority: task?.priority ?? 'medium',
    status: task?.status ?? 'not_started',
    subtasks: task?.subtasks ?? [],
    recurrence: task?.recurrence ?? { kind: 'none', weekdays: [], until: null },
    reminderTime: task?.reminderTime ?? '',
  }
}

function TaskForm({ task, dueDate, onClose }: { task: Task | null; dueDate: string | null; onClose: () => void }) {
  const categories = useTasksStore((state) => state.categories)
  const createTask = useTasksStore((state) => state.createTask)
  const saveTask = useTasksStore((state) => state.saveTask)
  const { guard, remove } = useTaskActions()

  const firstActive = categories.find((category) => !category.archived)
  const [form, setForm] = useState(() => initialState(task, { dueDate, categoryId: firstActive?.id ?? '' }))
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [errors, setErrors] = useState<{ title?: string; recurrence?: string }>({})

  const patch = (partial: Partial<FormState>) => setForm((current) => ({ ...current, ...partial }))

  const categoryOptions = useMemo<SelectOption[]>(() => {
    const options = categories
      .filter((category) => !category.archived || category.id === form.categoryId)
      .map((category) => ({
        value: category.id,
        label: category.archived ? `${category.name} (archived)` : category.name,
        color: category.colorKey,
      }))
    if (!options.some((option) => option.value === form.categoryId)) {
      options.push({ value: form.categoryId, label: 'Uncategorized', color: 'graphite' })
    }
    return options
  }, [categories, form.categoryId])

  const recurrenceOptions: SelectOption<RecurrenceKind>[] = RECURRENCE_KINDS.map((kind) => ({
    value: kind,
    label: RECURRENCE_LABEL[kind],
  }))

  const addSubtask = () => {
    const title = subtaskDraft.trim()
    if (!title) return
    patch({ subtasks: [...form.subtasks, { id: nanoid(8), title, done: false }] })
    setSubtaskDraft('')
  }

  const toggleWeekday = (day: number) => {
    const weekdays = form.recurrence.weekdays.includes(day)
      ? form.recurrence.weekdays.filter((existing) => existing !== day)
      : [...form.recurrence.weekdays, day]
    patch({ recurrence: { ...form.recurrence, weekdays } })
  }

  const submit = () => {
    const nextErrors: typeof errors = {}
    if (!form.title.trim()) nextErrors.title = 'Give this task a title.'
    if (form.recurrence.kind !== 'none' && !form.dueDate) {
      nextErrors.recurrence = 'Repeating tasks need a due date to start from.'
    } else if (form.recurrence.kind === 'weekdays' && form.recurrence.weekdays.length === 0) {
      nextErrors.recurrence = 'Pick at least one weekday.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    const recurring = form.recurrence.kind !== 'none'
    const fields = {
      title: form.title.trim(),
      notes: form.notes.trim(),
      dueDate: form.dueDate,
      dueTime: form.dueDate && form.dueTime ? form.dueTime : null,
      categoryId: form.categoryId,
      tags: form.tags,
      priority: form.priority,
      // Recurring tasks track completion per occurrence, not via status.
      status: recurring ? 'not_started' : form.status,
      subtasks: form.subtasks,
      recurrence: { ...form.recurrence, until: recurring ? form.recurrence.until : null },
      reminderTime: form.dueDate && form.reminderTime ? form.reminderTime : null,
    } satisfies Partial<Task>

    void guard(async () => {
      if (task) {
        const becameDone = fields.status === 'done' && task.status !== 'done'
        await saveTask({
          ...task,
          ...fields,
          completedAt: fields.status === 'done' ? (becameDone ? Date.now() : task.completedAt) : null,
        })
      } else {
        await createTask({
          ...makeTask({ ...fields }),
        })
      }
      onClose()
    })
  }

  const footer = (
    <>
      {task && (
        <Button
          variant="ghost"
          icon={Trash2}
          className="mr-auto text-overdue hover:bg-overdue-soft hover:text-overdue"
          onClick={() => {
            void remove([task.id])
            onClose()
          }}
        >
          Delete
        </Button>
      )}
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={submit}>
        {task ? 'Save changes' : 'Add task'}
      </Button>
    </>
  )

  return (
    <Dialog open onClose={onClose} title={task ? 'Edit task' : 'New task'} footer={footer} size="lg">
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Field label="Title" error={errors.title}>
          <TextInput
            data-autofocus
            aria-label="Title"
            aria-invalid={Boolean(errors.title)}
            value={form.title}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder="What needs doing?"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due date">
            <DatePicker
              ariaLabel="Due date"
              value={form.dueDate}
              onChange={(dueDate) => patch({ dueDate })}
              placeholder="No date"
            />
          </Field>
          <Field label="Due time">
            <Select
              ariaLabel="Due time"
              options={DUE_TIME_OPTIONS}
              value={form.dueTime}
              onChange={(dueTime) => patch({ dueTime })}
            />
          </Field>
          <Field label="Category">
            <Select
              ariaLabel="Category"
              options={categoryOptions}
              value={form.categoryId}
              onChange={(categoryId) => patch({ categoryId })}
              placeholder="Choose a category"
            />
          </Field>
          <Field label="Reminder">
            <Select
              ariaLabel="Reminder time"
              options={REMINDER_OPTIONS}
              value={form.reminderTime}
              onChange={(reminderTime) => patch({ reminderTime })}
            />
          </Field>
        </div>

        <Field label="Priority">
          <Segmented
            ariaLabel="Priority"
            value={form.priority}
            onChange={(priority) => patch({ priority })}
            options={PRIORITIES.map((value) => ({ value, label: PRIORITY_LABEL[value] }))}
          />
        </Field>

        {form.recurrence.kind === 'none' && (
          <Field label="Status">
            <Segmented
              ariaLabel="Status"
              value={form.status}
              onChange={(status) => patch({ status })}
              options={STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] }))}
            />
          </Field>
        )}

        <Field label="Repeat" error={errors.recurrence}>
          <div className="grid gap-3">
            <Select
              ariaLabel="Repeat"
              options={recurrenceOptions}
              value={form.recurrence.kind}
              onChange={(kind) => patch({ recurrence: { ...form.recurrence, kind } })}
              className="sm:max-w-xs"
            />
            {form.recurrence.kind === 'weekdays' && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Repeat on">
                {WEEKDAYS.map(({ day, label }) => (
                  <Pill
                    key={day}
                    pressed={form.recurrence.weekdays.includes(day)}
                    onClick={() => toggleWeekday(day)}
                  >
                    {label}
                  </Pill>
                ))}
              </div>
            )}
            {form.recurrence.kind !== 'none' && (
              <div className="sm:max-w-xs">
                <DatePicker
                  ariaLabel="Repeat until"
                  value={form.recurrence.until}
                  onChange={(until) => patch({ recurrence: { ...form.recurrence, until } })}
                  placeholder="Repeats forever"
                />
              </div>
            )}
          </div>
        </Field>

        <Field label="Tags">
          <TagInput value={form.tags} onChange={(tags) => patch({ tags })} />
        </Field>

        <Field label="Subtasks">
          <div className="grid gap-2">
            {form.subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-2">
                <Checkbox
                  checked={subtask.done}
                  ariaLabel={`Subtask done: ${subtask.title}`}
                  onChange={(done) =>
                    patch({ subtasks: form.subtasks.map((item) => (item.id === subtask.id ? { ...item, done } : item)) })
                  }
                />
                <TextInput
                  aria-label="Subtask title"
                  value={subtask.title}
                  onChange={(event) =>
                    patch({
                      subtasks: form.subtasks.map((item) =>
                        item.id === subtask.id ? { ...item, title: event.target.value } : item,
                      ),
                    })
                  }
                  className="h-9"
                />
                <button
                  type="button"
                  aria-label={`Remove subtask ${subtask.title}`}
                  onClick={() => patch({ subtasks: form.subtasks.filter((item) => item.id !== subtask.id) })}
                  className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-sunken hover:text-fg"
                >
                  <Icon icon={X} size={16} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <TextInput
                aria-label="Add a subtask"
                placeholder="Add a subtask…"
                value={subtaskDraft}
                onChange={(event) => setSubtaskDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addSubtask()
                  }
                }}
                className="h-9"
              />
              <Button size="sm" icon={Plus} onClick={addSubtask}>
                Add
              </Button>
            </div>
          </div>
        </Field>

        <Field label="Notes">
          <TextArea
            aria-label="Notes"
            value={form.notes}
            onChange={(event) => patch({ notes: event.target.value })}
            placeholder="Anything worth remembering"
          />
        </Field>
      </form>
    </Dialog>
  )
}

/** Mounted once; opens for new or existing tasks based on UI state. */
export function TaskEditor() {
  const editor = useUiStore((state) => state.editor)
  const close = useUiStore((state) => state.closeEditor)
  const tasks = useTasksStore((state) => state.tasks)

  if (!editor) return null
  const task = editor.mode === 'edit' ? (tasks.find((candidate) => candidate.id === editor.taskId) ?? null) : null
  if (editor.mode === 'edit' && !task) return null

  // Keyed so switching tasks resets the form.
  const key = editor.mode === 'edit' ? editor.taskId : `new-${editor.dueDate ?? 'none'}`
  return <TaskForm key={key} task={task} dueDate={editor.mode === 'new' ? editor.dueDate : null} onClose={close} />
}
