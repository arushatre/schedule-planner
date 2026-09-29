import { format } from 'date-fns'
import {
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  DatabaseZap,
  GraduationCap,
  Settings,
  ListChecks,
  Plus,
  SwatchBook,
  Tags,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Suspense, lazy } from 'react'

import { TaskEditor } from '@/components/task/TaskEditor'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { ToastHost } from '@/components/ui/ToastHost'
import { CategoryManager } from '@/features/categories/CategoryManager'
import { ScheduleManager } from '@/features/schedule/ScheduleManager'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { Kbd, ShortcutsDialog } from '@/features/settings/ShortcutsDialog'
import { TodayView } from '@/features/today/TodayView'
import { useReminders } from '@/hooks/useReminders'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useTheme } from '@/hooks/useTheme'
import { cx } from '@/lib/cx'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import type { View } from '@/store/ui'

// Heavy views (drag-and-drop, charts) load on demand to keep first paint fast.
const CalendarView = lazy(() =>
  import('@/features/calendar/CalendarView').then((module) => ({ default: module.CalendarView })),
)
const ListView = lazy(() => import('@/features/list/ListView').then((module) => ({ default: module.ListView })))
const InsightsView = lazy(() =>
  import('@/features/insights/InsightsView').then((module) => ({ default: module.InsightsView })),
)
const KitPage = lazy(() => import('@/features/kit/KitPage').then((module) => ({ default: module.KitPage })))

function LoadingRows() {
  return (
    <div role="status" aria-label="Loading" className="grid gap-3">
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-14 animate-pulse rounded-md border border-line bg-panel" />
      ))}
    </div>
  )
}

interface NavItem {
  view: View
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { view: 'today', label: 'Today', icon: CalendarCheck },
  { view: 'list', label: 'List', icon: ListChecks },
  { view: 'calendar', label: 'Calendar', icon: CalendarDays },
  { view: 'insights', label: 'Insights', icon: ChartColumn },
  ...(import.meta.env.DEV ? [{ view: 'kit' as const, label: 'UI kit', icon: SwatchBook }] : []),
]

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
  const openNewTask = useUiStore((state) => state.openNewTask)
  const openDialog = useUiStore((state) => state.openDialog)
  const ready = useTasksStore((state) => state.ready)
  const error = useTasksStore((state) => state.error)

  useShortcuts()
  useTheme()
  useReminders()

  const current = NAV.find((item) => item.view === view) ?? NAV[0]

  let body
  if (!ready) {
    body = <LoadingRows />
  } else if (error) {
    body = (
      <div className="rounded-lg border border-line bg-raised shadow-card">
        <EmptyState
          icon={DatabaseZap}
          title="Can’t open local storage"
          description={`Daybook caches your tasks in this browser’s IndexedDB so it works offline, and it isn’t available (${error}). Private windows and some strict privacy settings block it. Try a regular window.`}
        />
      </div>
    )
  } else if (view === 'today') {
    body = <TodayView />
  } else if (view === 'list') {
    body = <ListView />
  } else if (view === 'calendar') {
    body = <CalendarView />
  } else if (view === 'insights') {
    body = <InsightsView />
  } else if (import.meta.env.DEV) {
    body = <KitPage />
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-panel/80 p-4 shadow-card md:flex">
        <div className="mb-6 px-3 pt-1 font-display text-lg">Daybook</div>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavButton key={item.view} item={item} active={item.view === view} onSelect={() => setView(item.view)} />
          ))}
        </nav>
        <button
          type="button"
          onClick={() => openDialog('shortcuts')}
          className="mt-auto flex items-center justify-between rounded-md border border-transparent px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-sunken hover:text-fg"
        >
          Keyboard shortcuts
          <Kbd>?</Kbd>
        </button>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10 md:pt-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-fg-muted">{format(new Date(), 'EEEE, MMMM d')}</p>
            <h1 className="font-display text-xl">{current?.label}</h1>
          </div>
          {ready && !error && view !== 'kit' && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" icon={Tags} onClick={() => openDialog('categories')}>
                <span className="max-sm:sr-only">Categories</span>
              </Button>
              <Button variant="ghost" size="sm" icon={GraduationCap} onClick={() => openDialog('schedule')}>
                <span className="max-sm:sr-only">Schedule</span>
              </Button>
              <Button variant="ghost" size="sm" icon={Settings} onClick={() => openDialog('settings')}>
                <span className="max-sm:sr-only">Settings</span>
              </Button>
              <Button variant="primary" icon={Plus} onClick={openNewTask}>
                New task
              </Button>
            </div>
          )}
        </header>
        <div className="mx-auto max-w-5xl">
          <Suspense fallback={<LoadingRows />}>{body}</Suspense>
        </div>
      </main>

      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-30 flex gap-1 border-t border-line bg-panel p-2 shadow-pop md:hidden"
      >
        {NAV.map((item) => (
          <NavButton key={item.view} item={item} active={item.view === view} onSelect={() => setView(item.view)} />
        ))}
      </nav>

      {ready && !error && (
        <>
          <TaskEditor />
          <CategoryManager />
          <ScheduleManager />
          <SettingsDialog />
          <ShortcutsDialog />
        </>
      )}
      <ToastHost />
    </div>
  )
}
