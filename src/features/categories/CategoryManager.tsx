import { Archive, ArchiveRestore, Plus } from 'lucide-react'
import { useState } from 'react'

import { Swatches } from '@/components/task/Swatches'
import { CategoryDot } from '@/components/task/TaskBits'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextInput } from '@/components/ui/fields'
import { useTaskActions } from '@/hooks/useTaskActions'
import type { PaletteKey } from '@/lib/palette'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import type { Category } from '@/types/model'

function CategoryRow({ category }: { category: Category }) {
  const saveCategory = useTasksStore((state) => state.saveCategory)
  const { guard } = useTaskActions()
  const [name, setName] = useState(category.name)
  const [palette, setPalette] = useState(false)

  const commitName = () => {
    const trimmed = name.trim()
    if (!trimmed) return setName(category.name)
    if (trimmed !== category.name) void guard(() => saveCategory({ ...category, name: trimmed }))
  }

  return (
    <li className="rounded-md border border-line bg-panel p-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Change color of ${category.name}`}
          aria-expanded={palette}
          onClick={() => setPalette(!palette)}
          className="rounded-md border border-transparent p-2 transition-colors hover:bg-sunken"
        >
          <CategoryDot color={category.colorKey} className="h-4 w-4" />
        </button>
        <TextInput
          aria-label={`Name of ${category.name}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          className="h-9"
        />
        <Button
          size="sm"
          variant="ghost"
          icon={category.archived ? ArchiveRestore : Archive}
          onClick={() => void guard(() => saveCategory({ ...category, archived: !category.archived }))}
        >
          {category.archived ? 'Restore' : 'Archive'}
        </Button>
      </div>
      {palette && (
        <div className="mt-2 pl-1">
          <Swatches
            value={category.colorKey}
            onChange={(colorKey) => void guard(() => saveCategory({ ...category, colorKey }))}
          />
        </div>
      )}
    </li>
  )
}

export function CategoryManager() {
  const open = useUiStore((state) => state.dialog === 'categories')
  const openDialog = useUiStore((state) => state.openDialog)
  const categories = useTasksStore((state) => state.categories)
  const createCategory = useTasksStore((state) => state.createCategory)
  const { guard } = useTaskActions()

  const [name, setName] = useState('')
  const [color, setColor] = useState<PaletteKey>('teal')

  const active = categories.filter((category) => !category.archived)
  const archived = categories.filter((category) => category.archived)

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setName('')
    void guard(async () => {
      await createCategory(trimmed, color)
    })
  }

  return (
    <Dialog open={open} onClose={() => openDialog(null)} title="Categories">
      <div className="grid gap-5">
        <p className="text-sm text-fg-muted">
          Each category has one color, used everywhere its tasks appear. Archiving hides a category from
          pickers without touching its tasks.
        </p>
        <ul className="grid gap-2">
          {active.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>

        <form
          className="grid gap-3 rounded-md border border-dashed border-line-strong p-3"
          onSubmit={(event) => {
            event.preventDefault()
            add()
          }}
        >
          <div className="flex gap-2">
            <TextInput
              aria-label="New category name"
              placeholder="New category"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-9"
            />
            <Button type="submit" size="sm" variant="primary" icon={Plus} disabled={!name.trim()}>
              Add
            </Button>
          </div>
          <Swatches value={color} onChange={setColor} />
        </form>

        {archived.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-fg-muted">Archived</h3>
            <ul className="grid gap-2">
              {archived.map((category) => (
                <CategoryRow key={category.id} category={category} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  )
}
