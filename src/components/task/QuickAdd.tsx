import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { Icon } from '@/components/ui/Icon'
import { TextInput } from '@/components/ui/fields'
import { useTaskActions } from '@/hooks/useTaskActions'
import { makeTask } from '@/lib/tasks'
import { useTasksStore } from '@/store/tasks'

/** One-line add: type a title, press Enter, task lands on `dueDate`. */
export function QuickAdd({ dueDate, placeholder = 'Add a task…' }: { dueDate: string | null; placeholder?: string }) {
  const [title, setTitle] = useState('')
  const categories = useTasksStore((state) => state.categories)
  const createTask = useTasksStore((state) => state.createTask)
  const { guard } = useTaskActions()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    const category = categories.find((candidate) => !candidate.archived)
    setTitle('')
    void guard(async () => {
      await createTask(makeTask({ title: trimmed, categoryId: category?.id ?? '', dueDate }))
    })
  }

  return (
    <form onSubmit={submit} className="relative">
      <Icon icon={Plus} size={16} className="pointer-events-none absolute left-3 top-3 text-fg-subtle" />
      <TextInput
        aria-label={placeholder}
        placeholder={placeholder}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="pl-9"
      />
    </form>
  )
}
