import { CalendarDays, Plus } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
import { PALETTE, PALETTE_KEYS } from '@/lib/palette'
import { cx } from '@/lib/cx'

const priorityOptions: SelectOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const categoryOptions: SelectOption[] = [
  { value: 'school', label: 'School', color: 'slate' },
  { value: 'personal', label: 'Personal', color: 'moss' },
  { value: 'work', label: 'Work', color: 'clay' },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-5 shadow-card">
      <h2 className="mb-4 font-display text-lg">{title}</h2>
      {children}
    </section>
  )
}

// Dev-only page to eyeball every custom control and design token in one place.
export function KitPage() {
  const [checked, setChecked] = useState(true)
  const [priority, setPriority] = useState<string | null>('medium')
  const [category, setCategory] = useState<string | null>(null)

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title="Category palette">
        <div className="flex flex-wrap gap-3">
          {PALETTE_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2 text-sm text-fg-muted">
              <span className={cx('h-6 w-6 rounded-full border border-line', PALETTE[key].solid)} />
              {PALETTE[key].label}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <p className="font-display text-2xl">Fraunces 40</p>
        <p className="font-display text-xl">Fraunces 28</p>
        <p className="font-display text-lg">Fraunces 20</p>
        <p className="text-md">Instrument Sans 16: Essay draft, due Friday</p>
        <p className="text-base">Instrument Sans 14: body copy and controls</p>
        <p className="text-sm text-fg-muted">Instrument Sans 13: secondary text</p>
        <p className="tabular text-xs text-fg-subtle">Instrument Sans 12: 09:00 – 09:50</p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={Plus}>
            New task
          </Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="sm" variant="primary">
            Small
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Checkbox">
        <div className="flex flex-col gap-3">
          <Checkbox checked={checked} onChange={setChecked} label="Interactive" />
          <Checkbox checked={false} onChange={() => undefined} label="Unchecked" />
          <Checkbox checked={false} indeterminate onChange={() => undefined} label="Indeterminate" />
          <Checkbox checked onChange={() => undefined} label="Disabled" disabled />
        </div>
      </Section>

      <Section title="Select">
        <div className="grid max-w-xs gap-3">
          <Select
            ariaLabel="Priority"
            options={priorityOptions}
            value={priority}
            onChange={setPriority}
          />
          <Select
            ariaLabel="Category"
            options={categoryOptions}
            value={category}
            onChange={setCategory}
            placeholder="Choose a category"
          />
        </div>
      </Section>

      <Section title="Calendar chips">
        <div className="grid max-w-xs gap-2">
          <Chip label="Read chapter 4" color="slate" time="09:00" />
          <Chip label="Gym" color="moss" />
          <Chip label="Submit report" color="clay" time="17:00" overdue />
          <Chip label="Buy groceries" color="ochre" done />
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState
          icon={CalendarDays}
          title="Nothing scheduled"
          description="Tasks you add will appear here."
          action={<Button variant="primary" icon={Plus}>Add a task</Button>}
        />
      </Section>
    </div>
  )
}
