import { CalendarDays, Plus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
import {
  ACCENTS,
  DEFAULT_APPEARANCE,
  FONTS,
  PRESETS,
  RADII,
  TEXT_SIZES,
  TONES,
  tokensFor,
} from '@/lib/appearance'
import type { Appearance } from '@/lib/appearance'
import { cx } from '@/lib/cx'
import { PALETTE, PALETTE_KEYS } from '@/lib/palette'
import { THEME_LABEL, resolveTheme, systemPrefersDark } from '@/lib/theme'
import { useUiStore } from '@/store/ui'

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


const rgb = (triplet: string | undefined) => `rgb(${triplet ?? '0 0 0'})`

interface ChoiceProps<K extends string> {
  label: string
  options: Record<K, { label: string }>
  value: K
  onChange: (value: K) => void
  render?: (key: K) => ReactNode
}

function Choice<K extends string>({ label, options, value, onChange, render }: ChoiceProps<K>) {
  return (
    <div className="grid content-start gap-2">
      <span className="text-sm text-fg-muted">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {(Object.keys(options) as K[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === value}
            onClick={() => onChange(key)}
            className={cx(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
              key === value ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-raised text-fg-muted hover:bg-sunken hover:text-fg',
            )}
          >
            {render?.(key)}
            {options[key].label}
          </button>
        ))}
      </div>
    </div>
  )
}

const same = (a: Appearance, b: Appearance) => (Object.keys(a) as (keyof Appearance)[]).every((key) => a[key] === b[key])

// Every visual choice in the app, one click each; changes apply live and persist.
function AppearanceStudio() {
  const look = useUiStore((state) => state.appearance)
  const setLook = useUiStore((state) => state.setAppearance)
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const mode = resolveTheme(theme, systemPrefersDark())

  return (
    <section className="rounded-lg border border-line bg-panel p-5 shadow-card lg:col-span-2">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg">Make it yours</h2>
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setLook(DEFAULT_APPEARANCE)}>
          Reset
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PRESETS.map((preset) => {
          const tokens = tokensFor(preset.value, mode)
          const active = same(preset.value, look)
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={active}
              onClick={() => setLook(preset.value)}
              className={cx(
                'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                active ? 'border-accent bg-accent-soft' : 'border-line bg-raised hover:bg-sunken',
              )}
            >
              <span className="flex overflow-hidden rounded-md border border-line">
                {[tokens.canvas, tokens.panel, tokens.accent].map((color, index) => (
                  <span key={index} className="h-9 w-5" style={{ background: rgb(color) }} />
                ))}
              </span>
              <span style={{ fontFamily: FONTS[preset.value.displayFont].stack }} className="text-base">
                {preset.label}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Choice
          label="Mode"
          options={Object.fromEntries(Object.entries(THEME_LABEL).map(([key, label]) => [key, { label }])) as Record<keyof typeof THEME_LABEL, { label: string }>}
          value={theme}
          onChange={setTheme}
        />
        <Choice
          label="Background"
          options={TONES}
          value={look.tone}
          onChange={(tone) => setLook({ tone })}
          render={(key) => (
            <span className="h-4 w-4 rounded-full border border-line-strong" style={{ background: rgb(tokensFor({ ...look, tone: key }, mode)['line-strong']) }} />
          )}
        />
        <Choice
          label="Accent"
          options={ACCENTS}
          value={look.accent}
          onChange={(accent) => setLook({ accent })}
          render={(key) => <span className="h-4 w-4 rounded-full" style={{ background: `rgb(${ACCENTS[key][mode].join(' ')})` }} />}
        />
        <Choice label="Headings" options={FONTS} value={look.displayFont} onChange={(displayFont) => setLook({ displayFont })} render={(key) => <span style={{ fontFamily: FONTS[key].stack }}>Aa</span>} />
        <Choice label="Body text" options={FONTS} value={look.bodyFont} onChange={(bodyFont) => setLook({ bodyFont })} render={(key) => <span style={{ fontFamily: FONTS[key].stack }}>Aa</span>} />
        <Choice label="Corners" options={RADII} value={look.radius} onChange={(radius) => setLook({ radius })} />
        <Choice label="Text size" options={TEXT_SIZES} value={look.textSize} onChange={(textSize) => setLook({ textSize })} />
      </div>
    </section>
  )
}

// Customize page: the appearance controls, then every control rendered live with them.
export function KitPage() {
  const [checked, setChecked] = useState(true)
  const [priority, setPriority] = useState<string | null>('medium')
  const [category, setCategory] = useState<string | null>(null)

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <AppearanceStudio />

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
        <p className="font-display text-2xl">Good morning</p>
        <p className="font-display text-xl">This week</p>
        <p className="font-display text-lg">Section heading</p>
        <p className="text-md">Essay draft, due Friday</p>
        <p className="text-base">Body copy and controls</p>
        <p className="text-sm text-fg-muted">Secondary text</p>
        <p className="tabular text-xs text-fg-subtle">09:00 – 09:50</p>
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
