import { render, screen } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { SessionContext } from '@/auth/useSession'
import type { SessionContextValue } from '@/auth/useSession'
import { useTasksStore } from '@/store/tasks'
import { FakeRemote } from '@/test/fakeRemote'
import { AuthGate } from './AuthGate'

// Route the gate's SyncProvider to an in-memory backend instead of Supabase.
vi.mock('@/sync/remote', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/sync/remote')>()
  return { ...actual, createSupabaseRemote: () => new FakeRemote() }
})

function renderGate(status: SessionContextValue['status'], userId = crypto.randomUUID()) {
  const session = { user: { id: userId, email: 'sam@school.edu' } } as unknown as Session
  const noop = vi.fn(async () => ({ error: null }))
  const value: SessionContextValue = {
    status,
    session: status === 'signed_in' ? session : null,
    user: status === 'signed_in' ? session.user : null,
    signInWithPassword: noop,
    signUp: vi.fn(async () => ({ error: null, needsConfirmation: false })),
    sendMagicLink: noop,
    resendConfirmation: noop,
    sendPasswordReset: noop,
    updatePassword: noop,
    signOut: vi.fn(async () => undefined),
  }
  return render(
    <SessionContext.Provider value={value}>
      <AuthGate />
    </SessionContext.Provider>,
  )
}

describe('AuthGate', () => {
  it('shows a splash while the stored session is being read', () => {
    renderGate('loading')
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Today' })).not.toBeInTheDocument()
  })

  it('keeps the app behind the sign-in screen when signed out', () => {
    renderGate('signed_out')
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Today' })).not.toBeInTheDocument()
  })

  it('asks for a new password after a recovery link', () => {
    renderGate('recovery')
    expect(screen.getByRole('heading', { name: 'Set a new password' })).toBeInTheDocument()
  })

  it('boots the app from the user’s cache once signed in', async () => {
    renderGate('signed_in')
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    // A brand-new account gets the default categories after its first (fake) pull.
    await vi.waitFor(() =>
      expect(useTasksStore.getState().categories.map((category) => category.name)).toEqual(['School', 'Personal', 'Work']),
    )
  })
})
