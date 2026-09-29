import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import type { AuthFailure } from './errors'

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in' | 'recovery'

export interface AuthResult {
  error: AuthFailure | null
}

export interface SessionContextValue {
  status: AuthStatus
  session: Session | null
  user: User | null
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>
  /** `needsConfirmation` is true when the project requires email confirmation before sign-in. */
  signUp: (email: string, password: string) => Promise<AuthResult & { needsConfirmation: boolean }>
  sendMagicLink: (email: string) => Promise<AuthResult>
  resendConfirmation: (email: string) => Promise<AuthResult>
  sendPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)

/** The current Supabase session plus sign-in / sign-out actions. Must be used under AuthProvider. */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside <AuthProvider>.')
  return value
}
