import { CalendarDays, Clock, Plus, Repeat } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { Icon } from '@/components/ui/Icon'
import { TextInput } from '@/components/ui/fields'
import { useTaskActions } from '@/hooks/useTaskActions'
import { formatTime, friendlyDate, todayStr } from '@/lib/dates'
import { parseQuickAdd } from '@/lib/quickAdd'
import { categoryFor, makeTask } from '@/lib/tasks'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import { PRIORITY_LABEL, RECURRENCE_LABEL } from '@/types/model'
import { CategoryDot } from './TaskBits'

interface QuickAddProps {
  /** Date used when the text doesn't name one. */
  dueDate: string | null
  /** Accessible name for the input. */
  label: string
  placeholder?: string
}

function Understood({ icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-0.5 text-sm text-fg-muted">
      {icon && <Icon icon={icon} size={13} />}
      {children}
    </span>
  )
}

/**
 * One-line add with natural language: "Essay draft fri 5pm #school !high".
 * A live preview shows what was understood before you press Enter.
 */
export function QuickAdd({ dueDate, label, placeholder = 'Add a task, try “Essay draft fri 5pm #school”' }: QuickAddProps) {
  const [text, setText] = useState('')
  const categories = useTasksStore((state) => state.categories)
  const createTask = useTasksStore((state) => state.createTask)
  const deleteTasks = useTasksStore((state) => state.deleteTasks)
  const pushToast = useUiStore((state) => state.pushToast)
  const { guard } = useTaskActions()

  const parsed = useMemo(
    () => (text.trim() ? parseQuickAdd(text, { today: todayStr(), categories }) : null),
    [text, categories],
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!parsed || !parsed.title.trim()) return
    const category = parsed.categoryId ?? categories.find((candidate) => !candidate.archived)?.id ?? ''
    const date = parsed.dueDate ?? dueDate
    setText('')
    void guard(async () => {
      const task = await createTask(
        makeTask({
          title: parsed.title,
          categoryId: category,
          dueDate: date,
          dueTime: date ? parsed.dueTime : null,
          tags: parsed.tags,
          priority: parsed.priority ?? 'medium',
          ...(parsed.recurrence ? { recurrence: parsed.recurrence } : {}),
        }),
      )
      pushToast({
        message: `Added “${task.title}”${date ? ` · ${friendlyDate(date)}` : ''}`,
        actionLabel: 'Undo',
        onAction: () => void deleteTasks([task.id]),
      })
    })
  }

  const showsDate = parsed?.dueDate ?? null
  const category = parsed?.categoryId ? categoryFor(parsed.categoryId, categories) : null
  const understood =
    parsed &&
    (showsDate || parsed.dueTime || parsed.tags.length || category || parsed.priority || parsed.recurrence)

  return (
    <form onSubmit={submit} className="grid gap-2">
      <div className="relative">
        <Icon icon={Plus} size={16} className="pointer-events-none absolute left-3 top-3 text-fg-subtle" />
        <TextInput
          aria-label={label}
          placeholder={placeholder}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="pl-9"
        />
      </div>
      {understood && (
        <div className="flex flex-wrap items-center gap-1.5" aria-live="polite" aria-label="Understood as">
          {showsDate && <Understood icon={CalendarDays}>{friendlyDate(showsDate)}</Understood>}
          {parsed.dueTime && <Understood icon={Clock}>{formatTime(parsed.dueTime)}</Understood>}
          {parsed.recurrence && <Understood icon={Repeat}>{RECURRENCE_LABEL[parsed.recurrence.kind]}</Understood>}
          {category && (
            <Understood>
              <CategoryDot color={category.colorKey} />
              {category.name}
            </Understood>
          )}
          {parsed.tags.map((tag) => (
            <Understood key={tag}>#{tag}</Understood>
          ))}
          {parsed.priority && <Understood>{PRIORITY_LABEL[parsed.priority]} priority</Understood>}
        </div>
      )}
    </form>
  )
}
