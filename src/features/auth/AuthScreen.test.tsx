import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SessionContext } from '@/auth/useSession'
import type { AuthResult, SessionContextValue } from '@/auth/useSession'
import { AuthScreen } from './AuthScreen'

const ok: AuthResult = { error: null }

function renderScreen(overrides: Partial<SessionContextValue> = {}) {
  const value: SessionContextValue = {
    status: 'signed_out',
    session: null,
    user: null,
    signInWithPassword: vi.fn(async () => ok),
    signUp: vi.fn(async () => ({ error: null, needsConfirmation: true })),
    sendMagicLink: vi.fn(async () => ok),
    resendConfirmation: vi.fn(async () => ok),
    sendPasswordReset: vi.fn(async () => ok),
    updatePassword: vi.fn(async () => ok),
    signOut: vi.fn(async () => undefined),
    ...overrides,
  }
  render(
    <SessionContext.Provider value={value}>
      <AuthScreen />
    </SessionContext.Provider>,
  )
  return value
}

/** Resolves later, so the pending state can be observed. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}

describe('AuthScreen', () => {
  it('validates inline and does not call Supabase with a bad email', async () => {
    const user = userEvent.setup()
    const session = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Email me a magic link' }))

    const email = screen.getByLabelText('Email')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Enter your email address.')
    expect(session.sendMagicLink).not.toHaveBeenCalled()

    await user.type(email, 'nope')
    expect(email).toHaveAccessibleDescription('That doesn’t look like an email address.')
  })

  it('sends a magic link and shows the inbox state with a resend cooldown', async () => {
    const user = userEvent.setup()
    const session = renderScreen()
    await user.type(screen.getByLabelText('Email'), 'sam@school.edu')
    await user.click(screen.getByRole('button', { name: 'Email me a magic link' }))

    expect(session.sendMagicLink).toHaveBeenCalledWith('sam@school.edu')
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument()
    expect(screen.getByText('sam@school.edu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Use a different email' }))
    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
  })

  it('switches tabs with the keyboard', async () => {
    const user = userEvent.setup()
    renderScreen()
    const magicTab = screen.getByRole('tab', { name: 'Magic link' })
    expect(magicTab).toHaveAttribute('aria-selected', 'true')
    magicTab.focus()
    await user.keyboard('{ArrowRight}')

    const passwordTab = screen.getByRole('tab', { name: 'Password' })
    expect(passwordTab).toHaveAttribute('aria-selected', 'true')
    expect(passwordTab).toHaveFocus()
    expect(screen.getByLabelText('Password', { selector: 'input' })).toBeInTheDocument()
  })

  it('shows a pending state, then a mapped error callout, for password sign-in', async () => {
    const user = userEvent.setup()
    const pending = deferred<AuthResult>()
    const session = renderScreen({ signInWithPassword: vi.fn(() => pending.promise) })
    await user.click(screen.getByRole('tab', { name: 'Password' }))
    await user.type(screen.getByLabelText('Email'), 'sam@school.edu')
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'hunter22')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(session.signInWithPassword).toHaveBeenCalledWith('sam@school.edu', 'hunter22')
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
    expect(screen.getByLabelText('Email')).toBeDisabled()

    pending.resolve({ error: { kind: 'invalid_credentials', message: 'That email and password don’t match.' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('That email and password don’t match.')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('toggles the password field visibility', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('tab', { name: 'Password' }))
    const password = screen.getByLabelText('Password', { selector: 'input' })
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
  })

  it('creates an account and asks the user to confirm their email', async () => {
    const user = userEvent.setup()
    const session = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'new@school.edu')
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByLabelText('Password', { selector: 'input' })).toHaveAccessibleDescription('Use at least 8 characters.')
    expect(session.signUp).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Password', { selector: 'input' }), '-and-longer')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(session.signUp).toHaveBeenCalledWith('new@school.edu', 'short-and-longer')
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument()
  })

  it('offers to resend the confirmation email when sign-in needs it', async () => {
    const user = userEvent.setup()
    const session = renderScreen({
      signInWithPassword: vi.fn(async () => ({ error: { kind: 'email_not_confirmed' as const, message: 'Confirm your email first.' } })),
    })
    await user.click(screen.getByRole('tab', { name: 'Password' }))
    await user.type(screen.getByLabelText('Email'), 'sam@school.edu')
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'hunter22')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await user.click(await screen.findByRole('button', { name: 'Resend confirmation email' }))

    expect(session.resendConfirmation).toHaveBeenCalledWith('sam@school.edu')
    expect(await screen.findByText('Confirmation email sent. Check your inbox.')).toBeInTheDocument()
  })
})
