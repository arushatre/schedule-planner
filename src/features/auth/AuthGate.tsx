import { TriangleAlert } from 'lucide-react'

import { App } from '@/App'
import { useSession } from '@/auth/useSession'
import { EmptyState } from '@/components/ui/EmptyState'
import { ToastHost } from '@/components/ui/ToastHost'
import { supabaseConfigError } from '@/lib/supabase'
import { SyncProvider } from '@/sync/SyncProvider'
import { AuthScreen } from './AuthScreen'
import { ImportLocalDialog } from './ImportLocalDialog'
import { ResetPassword } from './ResetPassword'

function Splash() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center">
      <div className="h-10 w-10 animate-pulse rounded-md border border-line bg-panel" />
    </div>
  )
}

/** Nothing below the gate renders without a session, so every read and write is tied to auth.uid(). */
export function AuthGate() {
  const { status, user } = useSession()

  if (supabaseConfigError) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-line bg-raised shadow-card">
          <EmptyState icon={TriangleAlert} title="Daybook isn’t configured" description={supabaseConfigError} />
        </div>
      </main>
    )
  }

  if (status === 'loading') return <Splash />

  if (status === 'signed_in' && user) {
    return (
      <SyncProvider key={user.id} userId={user.id}>
        <App />
        <ImportLocalDialog />
      </SyncProvider>
    )
  }

  return (
    <>
      {status === 'recovery' ? <ResetPassword /> : <AuthScreen />}
      <ToastHost />
    </>
  )
}
