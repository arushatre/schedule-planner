import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'

import { supabase } from '@/lib/supabase'
import type { SupabaseClient } from '@/lib/supabase'
import { toAuthFailure } from './errors'
import { SessionContext } from './useSession'
import type { AuthResult, AuthStatus, SessionContextValue } from './useSession'

interface AuthProviderProps {
  children: ReactNode
  /** Injected in tests; defaults to the app's Supabase client. */
  client?: SupabaseClient
}

const ok: AuthResult = { error: null }

/**
 * Owns the Supabase session. supabase-js persists it in localStorage (so an offline reload
 * still boots signed in) and refreshes the access token on its own; this provider mirrors
 * those events into React state.
 */
export function AuthProvider({ children, client = supabase }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    // INITIAL_SESSION fires first with whatever is in storage, so it also ends 'loading'.
    const { data } = client.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setStatus('recovery')
      else setStatus((current) => (current === 'recovery' && next ? 'recovery' : next ? 'signed_in' : 'signed_out'))
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  const value = useMemo<SessionContextValue>(() => {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
    const settle = (error: Parameters<typeof toAuthFailure>[0] | null): AuthResult =>
      error ? { error: toAuthFailure(error) } : ok

    return {
      status,
      session,
      user: session?.user ?? null,

      signInWithPassword: async (email, password) => {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
        return settle(error)
      },

      signUp: async (email, password) => {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo },
        })
        if (error) return { error: toAuthFailure(error), needsConfirmation: false }
        // Supabase hides existing accounts behind an empty identities list instead of an error.
        if (data.user && data.user.identities?.length === 0) {
          return { error: toAuthFailure({ message: '', code: 'user_already_exists' }), needsConfirmation: false }
        }
        return { error: null, needsConfirmation: data.session === null }
      },

      sendMagicLink: async (email) => {
        const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo } })
        return settle(error)
      },

      resendConfirmation: async (email) => {
        const { error } = await client.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectTo } })
        return settle(error)
      },

      sendPasswordReset: async (email) => {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo })
        return settle(error)
      },

      updatePassword: async (password) => {
        const { error } = await client.auth.updateUser({ password })
        if (!error) setStatus('signed_in')
        return settle(error)
      },

      signOut: async () => {
        // 'local' works offline and leaves the user's other devices signed in.
        await client.auth.signOut({ scope: 'local' })
        setStatus('signed_out')
        setSession(null)
      },
    }
  }, [client, status, session])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
