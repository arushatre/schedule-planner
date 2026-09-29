import { act, render, renderHook, screen } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { SupabaseClient } from '@/lib/supabase'
import { AuthProvider } from './AuthProvider'
import { toAuthFailure, validateEmail, validatePassword } from './errors'
import { useSession } from './useSession'

describe('auth error mapping', () => {
  it('maps Supabase errors to plain-language kinds', () => {
    expect(toAuthFailure({ message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 }, true).kind).toBe(
      'invalid_credentials',
    )
    expect(toAuthFailure({ message: 'x', code: 'email_not_confirmed', status: 400 }, true).kind).toBe('email_not_confirmed')
    expect(toAuthFailure({ message: 'x', code: 'over_email_send_rate_limit', status: 429 }, true).kind).toBe('rate_limited')
    expect(toAuthFailure({ message: 'TypeError: Failed to fetch', status: 0 }, true).kind).toBe('offline')
    expect(toAuthFailure({ message: 'anything' }, false).kind).toBe('offline')
    expect(toAuthFailure({ message: 'Database error saving new user', status: 500 }, true)).toEqual({
      kind: 'unknown',
      message: 'Database error saving new user',
    })
  })

  it('validates email and password inputs', () => {
    expect(validateEmail('')).toMatch(/enter your email/i)
    expect(validateEmail('not-an-email')).toMatch(/doesn’t look like/)
    expect(validateEmail(' a@b.co ')).toBeNull()
    expect(validatePassword('short', 'sign_up')).toMatch(/at least 8/)
    expect(validatePassword('short', 'sign_in')).toBeNull()
    expect(validatePassword('', 'sign_in')).toMatch(/enter your password/i)
  })
})

function fakeClient() {
  let emit: (event: AuthChangeEvent, session: Session | null) => void = () => undefined
  const unsubscribe = vi.fn()
  const auth = {
    onAuthStateChange: vi.fn((callback: typeof emit) => {
      emit = callback
      return { data: { subscription: { unsubscribe } } }
    }),
    signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  }
  return {
    client: { auth } as unknown as SupabaseClient,
    auth,
    unsubscribe,
    emit: (event: AuthChangeEvent, session: Session | null) => act(() => emit(event, session)),
  }
}

const session = { user: { id: 'u1', email: 'a@b.co' } } as unknown as Session

function Probe() {
  const { status, user } = useSession()
  return (
    <p>
      {status}:{user?.email ?? 'none'}
    </p>
  )
}

describe('AuthProvider / useSession', () => {
  it('tracks the session through sign-in, token refresh, recovery and sign-out', async () => {
    const fake = fakeClient()
    const { unmount } = render(
      <AuthProvider client={fake.client}>
        <Probe />
      </AuthProvider>,
    )
    expect(screen.getByText('loading:none')).toBeInTheDocument()

    fake.emit('INITIAL_SESSION', null)
    expect(screen.getByText('signed_out:none')).toBeInTheDocument()

    fake.emit('SIGNED_IN', session)
    expect(screen.getByText('signed_in:a@b.co')).toBeInTheDocument()

    fake.emit('TOKEN_REFRESHED', session)
    expect(screen.getByText('signed_in:a@b.co')).toBeInTheDocument()

    fake.emit('PASSWORD_RECOVERY', session)
    // The SIGNED_IN that accompanies a recovery link must not skip the set-password screen.
    fake.emit('SIGNED_IN', session)
    expect(screen.getByText('recovery:a@b.co')).toBeInTheDocument()

    fake.emit('SIGNED_OUT', null)
    expect(screen.getByText('signed_out:none')).toBeInTheDocument()

    unmount()
    expect(fake.unsubscribe).toHaveBeenCalled()
  })

  it('returns mapped failures from actions and signs out locally', async () => {
    const fake = fakeClient()
    fake.auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 },
    } as never)
    const { result } = renderHook(() => useSession(), {
      wrapper: ({ children }) => <AuthProvider client={fake.client}>{children}</AuthProvider>,
    })

    const outcome = await act(() => result.current.signInWithPassword(' a@b.co ', 'pw'))
    expect(fake.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'pw' })
    expect(outcome.error?.kind).toBe('invalid_credentials')

    await act(() => result.current.signOut())
    expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(result.current.status).toBe('signed_out')
  })

  it('throws a clear error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => renderHook(() => useSession())).toThrow(/inside <AuthProvider>/)
  })
})
