import { Plus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { TextInput } from '@/components/ui/fields'
import { Select } from '@/components/ui/Select'
import { CategoryRow } from '@/features/categories/CategoryManager'
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
import type { Personal } from '@/lib/appearance'
import { cx } from '@/lib/cx'
import { defaultCategoryId } from '@/lib/tasks'
import { THEME_LABEL, resolveTheme, systemPrefersDark } from '@/lib/theme'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import { PRIORITIES, PRIORITY_LABEL } from '@/types/model'

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
        <Choice label="Corners" options={RADII} value={look.radius} onChange={(radius) => setLook({ radius })} />
      </div>
    </section>
  )
}

// Fonts and text size for the whole app. The presets above set a matching pair in one click.
function TypographyCard() {
  const look = useUiStore((state) => state.appearance)
  const setLook = useUiStore((state) => state.setAppearance)
  const fontPill = (key: keyof typeof FONTS) => <span style={{ fontFamily: FONTS[key].stack }}>Aa</span>

  return (
    <Section title="Typography">
      <div className="grid gap-5">
        <Choice label="Heading font" options={FONTS} value={look.displayFont} onChange={(displayFont) => setLook({ displayFont })} render={fontPill} />
        <Choice label="Body font" options={FONTS} value={look.bodyFont} onChange={(bodyFont) => setLook({ bodyFont })} render={fontPill} />
        <Choice label="Text size" options={TEXT_SIZES} value={look.textSize} onChange={(textSize) => setLook({ textSize })} />
      </div>
    </Section>
  )
}

/** Your name for the Dashboard greeting; saves on Enter or when you leave the field. */
function NameField() {
  const personal = useUiStore((state) => state.personal)
  const setPersonal = useUiStore((state) => state.setPersonal)
  const [name, setName] = useState(personal.name)
  return (
    <label className="grid max-w-xs gap-1.5">
      <span className="text-sm text-fg-muted">Your name, for the greeting</span>
      <TextInput
        value={name}
        maxLength={40}
        placeholder="Add your name"
        onChange={(event) => setName(event.target.value)}
        onBlur={() => setPersonal({ name: name.trim() })}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
      />
    </label>
  )
}

const SECTIONS: { key: 'showNextUp' | 'showSchedule'; label: string }[] = [
  { key: 'showNextUp', label: 'Next up card' },
  { key: 'showSchedule', label: 'Hour-by-hour schedule' },
]

// Customize page: the look, then the settings that shape your Dashboard and new tasks.
export function KitPage() {
  const personal = useUiStore((state) => state.personal)
  const setPersonal = useUiStore((state) => state.setPersonal)
  const openDialog = useUiStore((state) => state.openDialog)
  const categories = useTasksStore((state) => state.categories)
  const active = categories.filter((category) => !category.archived)
  const set = (patch: Partial<Personal>) => setPersonal(patch)

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <AppearanceStudio />

      <TypographyCard />

      <Section title="Your categories">
        <p className="-mt-2 mb-3 text-sm text-fg-muted">Rename a category, or click its dot to change its color everywhere.</p>
        <ul className="grid gap-2">
          {active.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
        <Button className="mt-3" variant="ghost" size="sm" icon={Plus} onClick={() => openDialog('categories')}>
          Add or restore categories
        </Button>
      </Section>

      <Section title="Dashboard">
        <p className="-mt-2 mb-3 text-sm text-fg-muted">Your greeting, and what your Dashboard shows. Overdue appears only when something is late.</p>
        <NameField />
        <div className="mt-4 flex flex-col gap-3">
          {SECTIONS.map(({ key, label }) => (
            <Checkbox key={key} checked={personal[key]} onChange={(on) => set({ [key]: on })} label={label} />
          ))}
        </div>
      </Section>

      <Section title="New tasks">
        <p className="-mt-2 mb-3 text-sm text-fg-muted">Where a task starts when you don’t say otherwise, in quick-add or the editor.</p>
        <div className="grid max-w-xs gap-3">
          <Select
            ariaLabel="Default priority"
            options={PRIORITIES.map((priority) => ({ value: priority, label: `${PRIORITY_LABEL[priority]} priority` }))}
            value={personal.defaultPriority}
            onChange={(defaultPriority) => set({ defaultPriority })}
          />
          <Select
            ariaLabel="Default category"
            options={active.map((category) => ({ value: category.id, label: category.name, color: category.colorKey }))}
            value={defaultCategoryId(categories, personal.defaultCategoryId) || null}
            onChange={(defaultCategoryId) => set({ defaultCategoryId })}
            placeholder="No categories yet"
          />
        </div>
      </Section>
    </div>
  )
}
