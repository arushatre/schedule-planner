export type AuthFailureKind =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_exists'
  | 'weak_password'
  | 'rate_limited'
  | 'offline'
  | 'unknown'

export interface AuthFailure {
  kind: AuthFailureKind
  message: string
}

interface AuthErrorLike {
  message: string
  code?: string
  status?: number
}

const MESSAGES: Record<Exclude<AuthFailureKind, 'unknown'>, string> = {
  invalid_credentials: 'That email and password don’t match. Check for typos, or use a magic link instead.',
  email_not_confirmed: 'Confirm your email first. We can send the confirmation link again.',
  user_exists: 'An account with this email already exists. Sign in instead.',
  weak_password: 'Choose a stronger password: at least 8 characters, not a common one.',
  rate_limited: 'Too many attempts. Wait a minute, then try again.',
  offline: 'You’re offline. Connect to the internet to sign in.',
}

/** Turns Supabase auth errors into plain-language messages the UI can show as-is. */
export function toAuthFailure(error: AuthErrorLike, online = navigator.onLine): AuthFailure {
  const code = error.code ?? ''
  let kind: AuthFailureKind = 'unknown'
  if (!online || error.status === 0 || /failed to fetch|networkerror|load failed/i.test(error.message)) kind = 'offline'
  else if (code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) kind = 'invalid_credentials'
  else if (code === 'email_not_confirmed') kind = 'email_not_confirmed'
  else if (code === 'user_already_exists' || code === 'email_exists') kind = 'user_exists'
  else if (code === 'weak_password') kind = 'weak_password'
  else if (code.startsWith('over_') || error.status === 429) kind = 'rate_limited'

  return { kind, message: kind === 'unknown' ? error.message || 'Something went wrong. Try again.' : MESSAGES[kind] }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Enter your email address.'
  if (!EMAIL.test(email.trim())) return 'That doesn’t look like an email address.'
  return null
}

export const MIN_PASSWORD = 8

export function validatePassword(password: string, mode: 'sign_in' | 'sign_up'): string | null {
  if (!password) return 'Enter your password.'
  if (mode === 'sign_up' && password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`
  return null
}
