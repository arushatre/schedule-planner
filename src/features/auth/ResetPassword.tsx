import { useState } from 'react'
import type { FormEvent } from 'react'

import { MIN_PASSWORD, validatePassword } from '@/auth/errors'
import type { AuthFailure } from '@/auth/errors'
import { useSession } from '@/auth/useSession'
import { useUiStore } from '@/store/ui'
import { AuthCard, Callout, PasswordField, SubmitButton, TextLink } from './AuthParts'

/** Shown after following a password-reset email link (Supabase PASSWORD_RECOVERY event). */
export function ResetPassword() {
  const { updatePassword, signOut, user } = useSession()
  const pushToast = useUiStore((state) => state.pushToast)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<AuthFailure | null>(null)

  const passwordError = submitted ? validatePassword(password, 'sign_up') : null
  const confirmError = submitted && confirm !== password ? 'Passwords don’t match.' : null

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (validatePassword(password, 'sign_up') || confirm !== password) return
    setPending(true)
    const { error } = await updatePassword(password)
    setPending(false)
    setFailure(error)
    if (!error) pushToast({ message: 'Password updated. You’re signed in.' })
  }

  return (
    <AuthCard title="Set a new password" subtitle={user?.email ? `For ${user.email}` : undefined}>
      <form noValidate aria-busy={pending} onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        {failure && <Callout tone="error">{failure.message}</Callout>}
        <fieldset disabled={pending} className="flex flex-col gap-4">
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={password}
            error={passwordError}
            hint={`At least ${MIN_PASSWORD} characters.`}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            error={confirmError}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </fieldset>
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save password
        </SubmitButton>
        <div className="text-center">
          <TextLink onClick={() => void signOut()} disabled={pending}>
            Cancel and sign out
          </TextLink>
        </div>
      </form>
    </AuthCard>
  )
}
