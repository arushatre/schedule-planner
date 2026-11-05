import { AnimatePresence, motion } from 'framer-motion'
import { useId, useState } from 'react'
import type { FormEvent } from 'react'

import { validateEmail, validatePassword, MIN_PASSWORD } from '@/auth/errors'
import type { AuthFailure } from '@/auth/errors'
import { useSession } from '@/auth/useSession'
import { Checkbox } from '@/components/ui/Checkbox'
import { cx } from '@/lib/cx'
import { setKeepSignedIn } from '@/lib/supabase'
import { useOnline } from '@/hooks/useOnline'
import { useUiStore } from '@/store/ui'
import { AuthCard, AuthField, Callout, PasswordField, SubmitButton, TextLink, fade } from './AuthParts'
import { InboxNotice } from './InboxNotice'
import { MethodTabs } from './MethodTabs'
import type { Method } from './MethodTabs'

type Mode = 'sign_in' | 'sign_up'

export function AuthScreen() {
  const session = useSession()
  const online = useOnline()
  const pushToast = useUiStore((state) => state.pushToast)
  const panelId = useId()

  const [method, setMethod] = useState<Method>('magic')
  const [mode, setMode] = useState<Mode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Starts ticked on every sign-in, so one untick on a shared computer never sticks.
  const [keepSignedIn, setKeep] = useState(true)
  const [touched, setTouched] = useState({ email: false, password: false })
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<AuthFailure | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [inbox, setInbox] = useState<'magic' | 'confirm' | null>(null)

  const emailError = touched.email || submitted ? validateEmail(email) : null
  const passwordError = method === 'password' && (touched.password || submitted) ? validatePassword(password, mode) : null

  const reset = () => {
    setSubmitted(false)
    setTouched({ email: false, password: false })
    setFailure(null)
    setNotice(null)
  }

  const run = async (action: () => Promise<AuthFailure | null>) => {
    setPending(true)
    setFailure(null)
    setNotice(null)
    const result = await action()
    setPending(false)
    setFailure(result)
    return result
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (validateEmail(email) || (method === 'password' && validatePassword(password, mode))) return
    // Read by the auth storage when the new session is saved (also after a magic or confirmation link).
    setKeepSignedIn(keepSignedIn)

    if (method === 'magic') {
      const error = await run(async () => (await session.sendMagicLink(email)).error)
      if (!error) setInbox('magic')
      return
    }
    if (mode === 'sign_in') {
      const error = await run(async () => (await session.signInWithPassword(email, password)).error)
      if (!error) pushToast({ message: `Signed in as ${email.trim()}` })
      return
    }
    await run(async () => {
      const result = await session.signUp(email, password)
      if (!result.error && result.needsConfirmation) setInbox('confirm')
      if (!result.error && !result.needsConfirmation) pushToast({ message: `Welcome to Daybook, ${email.trim()}` })
      return result.error
    })
  }

  const forgotPassword = async () => {
    setTouched((current) => ({ ...current, email: true }))
    if (validateEmail(email)) return
    const error = await run(async () => (await session.sendPasswordReset(email)).error)
    if (!error) setNotice(`If an account exists for ${email.trim()}, a password reset link is on its way.`)
  }

  const resendConfirmation = () => run(async () => (await session.resendConfirmation(email)).error).then((error) => {
    if (!error) setNotice('Confirmation email sent. Check your inbox.')
  })

  const signUp = mode === 'sign_up'
  const title = inbox ? 'Almost there' : signUp ? 'Create your account' : 'Welcome back'

  return (
    <AuthCard
      title={title}
      subtitle={
        inbox ? undefined : (
          <>
            {signUp ? 'Already have an account? ' : 'New to Daybook? '}
            <TextLink
              onClick={() => {
                setMode(signUp ? 'sign_in' : 'sign_up')
                if (!signUp) setMethod('password')
                reset()
              }}
            >
              {signUp ? 'Sign in' : 'Create an account'}
            </TextLink>
          </>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {inbox ? (
          <InboxNotice
            key="inbox"
            email={email.trim()}
            onResend={async () =>
              (inbox === 'magic' ? await session.sendMagicLink(email) : await session.resendConfirmation(email)).error
            }
            onBack={() => {
              setInbox(null)
              reset()
            }}
          />
        ) : (
          <motion.div key="form" {...fade}>
            {!signUp && (
              <MethodTabs
                value={method}
                panelId={panelId}
                onChange={(next) => {
                  setMethod(next)
                  setFailure(null)
                  setNotice(null)
                }}
              />
            )}

            <form
              id={panelId}
              role={signUp ? undefined : 'tabpanel'}
              aria-labelledby={signUp ? undefined : `${panelId}-tab-${method}`}
              aria-busy={pending}
              noValidate
              onSubmit={(event) => void onSubmit(event)}
              className={cx('flex flex-col gap-4', !signUp && 'mt-5')}
            >
              {!online && <Callout tone="info">You’re offline. Connect to the internet to sign in.</Callout>}
              {failure && (
                <Callout
                  tone="error"
                  action={
                    failure.kind === 'email_not_confirmed' ? (
                      <TextLink onClick={() => void resendConfirmation()} disabled={pending}>
                        Resend confirmation email
                      </TextLink>
                    ) : failure.kind === 'user_exists' ? (
                      <TextLink
                        onClick={() => {
                          setMode('sign_in')
                          reset()
                        }}
                      >
                        Go to sign in
                      </TextLink>
                    ) : undefined
                  }
                >
                  {failure.message}
                </Callout>
              )}
              {notice && <Callout tone="success">{notice}</Callout>}

              <fieldset disabled={pending} className="flex flex-col gap-4">
                <AuthField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@school.edu"
                  value={email}
                  error={emailError}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                />
                {method === 'password' && (
                  <PasswordField
                    label="Password"
                    autoComplete={signUp ? 'new-password' : 'current-password'}
                    value={password}
                    error={passwordError}
                    hint={signUp ? `At least ${MIN_PASSWORD} characters.` : undefined}
                    onChange={(event) => setPassword(event.target.value)}
                    onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                    labelAside={
                      !signUp && (
                        <TextLink onClick={() => void forgotPassword()} disabled={pending}>
                          Forgot password?
                        </TextLink>
                      )
                    }
                  />
                )}
                <Checkbox checked={keepSignedIn} onChange={setKeep} label="Keep me signed in" />
              </fieldset>

              <SubmitButton
                pending={pending}
                pendingLabel={method === 'magic' ? 'Sending link…' : signUp ? 'Creating account…' : 'Signing in…'}
              >
                {method === 'magic' ? 'Email me a magic link' : signUp ? 'Create account' : 'Sign in'}
              </SubmitButton>
              {method === 'magic' && (
                <p className="text-center text-sm text-fg-subtle">No password needed. We’ll email you a one-time sign-in link.</p>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthCard>
  )
}
