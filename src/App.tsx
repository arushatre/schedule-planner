import { format } from 'date-fns'
import { CalendarCheck, CalendarDays, ListChecks, SwatchBook } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { KitPage } from '@/features/kit/KitPage'
import { cx } from '@/lib/cx'
import { useUiStore } from '@/store/ui'
import type { View } from '@/store/ui'

interface NavItem {
  view: View
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { view: 'today', label: 'Today', icon: CalendarCheck },
  { view: 'list', label: 'List', icon: ListChecks },
  { view: 'calendar', label: 'Calendar', icon: CalendarDays },
  ...(import.meta.env.DEV ? [{ view: 'kit' as const, label: 'UI kit', icon: SwatchBook }] : []),
]

const PLACEHOLDERS: Record<Exclude<View, 'kit'>, { title: string; description: string; icon: LucideIcon }> = {
  today: {
    title: 'Nothing due today',
    description: 'Tasks due today, anything overdue and your week ahead will show up here.',
    icon: CalendarCheck,
  },
  list: {
    title: 'No tasks yet',
    description: 'Every task you add will appear here, ready to filter, group and check off.',
    icon: ListChecks,
  },
  calendar: {
    title: 'Your calendar is empty',
    description: 'Tasks with a due date will show up on the calendar.',
    icon: CalendarDays,
  },
}

function NavButton({ item, active, onSelect }: { item: NavItem; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex items-center gap-3 rounded-md border px-3 py-2 text-base transition-colors',
        'max-md:flex-1 max-md:flex-col max-md:gap-1 max-md:text-xs',
        active
          ? 'border-accent/25 bg-accent-soft text-accent'
          : 'border-transparent text-fg-muted hover:bg-sunken hover:text-fg',
      )}
    >
      <Icon icon={item.icon} />
      {item.label}
    </button>
  )
}

export function App() {
  const view = useUiStore((state) => state.view)
  const setView = useUiStore((state) => state.setView)

  const current = NAV.find((item) => item.view === view) ?? NAV[0]
  const placeholder = view === 'kit' ? null : PLACEHOLDERS[view]

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-panel/80 p-4 shadow-card md:flex">
        <div className="mb-6 px-3 pt-1 font-display text-lg">Daybook</div>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavButton
              key={item.view}
              item={item}
              active={item.view === view}
              onSelect={() => setView(item.view)}
            />
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-10 md:pb-10 md:pt-10">
        <header className="mb-8">
          <p className="text-sm text-fg-muted">{format(new Date(), 'EEEE, MMMM d')}</p>
          <h1 className="font-display text-xl">{current?.label}</h1>
        </header>

        {view === 'kit' && import.meta.env.DEV && <KitPage />}
        {placeholder && (
          <div className="rounded-lg border border-line bg-raised shadow-card">
            <EmptyState
              icon={placeholder.icon}
              title={placeholder.title}
              description={placeholder.description}
            />
          </div>
        )}
      </main>

      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 flex gap-1 border-t border-line bg-panel p-2 shadow-pop md:hidden"
      >
        {NAV.map((item) => (
          <NavButton
            key={item.view}
            item={item}
            active={item.view === view}
            onSelect={() => setView(item.view)}
          />
        ))}
      </nav>
    </div>
  )
}
