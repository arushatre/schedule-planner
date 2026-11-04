import { format } from 'date-fns'
import { CalendarSync, Unlink } from 'lucide-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { disconnectGoogleCalendar, googleClientId, syncGoogleCalendar, useGoogleCalendar } from '@/lib/googleCalendar'
import { useTasksStore } from '@/store/tasks'

/** While connected, pushes edits a few seconds after they settle (only while Google's token is still valid). */
export function useGoogleAutoSync(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = useTasksStore.subscribe((state, previous) => {
      if (state.tasks === previous.tasks && state.classBlocks === previous.classBlocks) return
      if (!useGoogleCalendar.getState().connected) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        const latest = useTasksStore.getState()
        void syncGoogleCalendar(latest.tasks, latest.classBlocks, false)
      }, 3000)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [])
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 rounded-md border border-line bg-panel p-4">
      <p className="text-base font-medium">{title}</p>
      {children}
    </div>
  )
}

function GooglePanel() {
  const { connected, syncing, lastSyncedAt, eventCount, error } = useGoogleCalendar()
  const sync = () => {
    const { tasks, classBlocks } = useTasksStore.getState()
    void syncGoogleCalendar(tasks, classBlocks, true)
  }

  if (!googleClientId) {
    return (
      <Panel title="Google Calendar">
        <p className="text-sm text-fg-muted">
          Needs a one-time setup: create a Google OAuth client ID and add it to <code>.env</code> as{' '}
          <code>VITE_GOOGLE_CLIENT_ID</code>. The README’s “Google Calendar” section walks through it in five steps.
        </p>
      </Panel>
    )
  }

  let status = 'Adds your dated tasks and classes to a separate “Daybook” calendar. Your other calendars aren’t touched.'
  if (syncing) status = 'Syncing…'
  else if (connected && lastSyncedAt) {
    status = `${eventCount} events synced at ${format(lastSyncedAt, 'p')}. New edits sync on their own for about an hour; after that, press Sync now.`
  } else if (connected) status = 'Connected. Press Sync now to send your latest changes.'

  return (
    <Panel title="Google Calendar">
      <p className="text-sm text-fg-muted" aria-live="polite">
        {status}
      </p>
      {error && (
        <p role="alert" className="text-sm text-overdue">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant={connected ? 'secondary' : 'primary'} icon={CalendarSync} disabled={syncing} onClick={sync}>
          {connected ? 'Sync now' : 'Connect Google Calendar'}
        </Button>
        {connected && (
          <Button variant="ghost" icon={Unlink} disabled={syncing} onClick={disconnectGoogleCalendar}>
            Disconnect
          </Button>
        )}
      </div>
    </Panel>
  )
}

/** Settings section for showing Daybook inside Google, iPhone, and Mac calendars. */
export function CalendarSyncSection() {
  return (
    <section className="grid gap-3 border-t border-line pt-5">
      <h3 className="text-base font-medium">Calendar apps</h3>
      <GooglePanel />
      <Panel title="iPhone and Mac Calendar">
        <p className="text-sm text-fg-muted">
          Apple Calendar can’t be reached from a web page, so it shows Daybook through Google. Connect Google above, then
          either:
        </p>
        <ul className="grid list-disc gap-2 pl-5 text-sm text-fg-muted">
          <li>
            <span className="text-fg">Add your Google account.</span> iPhone: Settings → Apps → Calendar → Calendar
            Accounts → Add Account → Google. Mac: Calendar → Settings → Accounts → +. Then turn on “Daybook”.
          </li>
          <li>
            <span className="text-fg">Or subscribe to just this calendar.</span> In Google Calendar on the web, open
            Daybook’s settings and copy “Secret address in iCal format”. On a Mac choose File → New Calendar
            Subscription; on iPhone use Calendar Accounts → Add Account → Other → Add Subscribed Calendar.
          </li>
        </ul>
        <p className="text-sm text-fg-muted">For a one-time copy instead, use Export calendar (.ics) below.</p>
      </Panel>
    </section>
  )
}
