import { CircleAlert, CloudCheck, CloudOff, LogOut, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'

import { useSession } from '@/auth/useSession'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'
import { useSyncStatus } from '@/store/sync'
import type { SyncStatus } from '@/sync/engine'
import { useTasksStore } from '@/store/tasks'

const changes = (count: number) => `${count} change${count === 1 ? '' : 's'}`

function syncSummary(status: SyncStatus): { icon: LucideIcon; text: string; tone: 'ok' | 'muted' | 'error'; spin?: boolean } {
  if (status.state === 'offline') {
    return {
      icon: CloudOff,
      tone: 'muted',
      text: status.pending
        ? `Offline. ${changes(status.pending)} will sync when you reconnect.`
        : 'Offline. Keep working; changes sync when you reconnect.',
    }
  }
  if (status.state === 'syncing') return { icon: RefreshCw, tone: 'muted', text: 'Syncing…', spin: true }
  if (status.state === 'error') {
    return { icon: CircleAlert, tone: 'error', text: `Couldn’t reach the server (${status.lastError ?? 'unknown error'}). Retrying automatically.` }
  }
  if (status.pending) return { icon: RefreshCw, tone: 'muted', text: `${changes(status.pending)} waiting to sync.` }
  return {
    icon: CloudCheck,
    tone: 'ok',
    text: status.lastPulledAt ? `All changes synced · checked ${format(status.lastPulledAt, 'p')}` : 'All changes synced',
  }
}

/** Signed-in email, live sync status with a manual sync, and sign-out. */
export function AccountSection({ onSignOut }: { onSignOut: () => void }) {
  const { user, signOut } = useSession()
  const status = useSyncStatus()
  const syncNow = useTasksStore((state) => state.syncNow)
  const [signingOut, setSigningOut] = useState(false)
  const summary = syncSummary(status)

  return (
    <section className="grid gap-2">
      <h3 className="text-base font-medium">Account</h3>
      <p className="text-sm text-fg-muted">
        Signed in as <span className="font-medium text-fg">{user?.email}</span>
      </p>
      <div
        role="status"
        className={cx(
          'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
          summary.tone === 'error' ? 'border-overdue/30 bg-overdue-soft' : 'border-line bg-panel',
        )}
      >
        <Icon
          icon={summary.icon}
          size={16}
          className={cx(
            'shrink-0',
            summary.spin && 'animate-spin',
            summary.tone === 'ok' ? 'text-accent' : summary.tone === 'error' ? 'text-overdue' : 'text-fg-muted',
          )}
        />
        <span className="min-w-0 flex-1">{summary.text}</span>
        {status.state !== 'offline' && (
          <Button size="sm" variant="ghost" disabled={status.state === 'syncing'} onClick={() => void syncNow()}>
            {status.state === 'error' ? 'Retry now' : 'Sync now'}
          </Button>
        )}
      </div>
      {status.pending > 0 && (
        <p className="text-sm text-fg-subtle">
          If you sign out now, unsynced changes stay on this device and sync the next time you sign in here.
        </p>
      )}
      <div>
        <Button
          icon={LogOut}
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true)
            onSignOut()
            void signOut()
          }}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </section>
  )
}

