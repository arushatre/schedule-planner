import { AnimatePresence, motion } from 'framer-motion'
import { MailCheck } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

import { validateEmail, validatePassword, MIN_PASSWORD } from '@/auth/errors'
import type { AuthFailure } from '@/auth/errors'
import { useSession } from '@/auth/useSession'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'
import { useOnline } from '@/hooks/useOnline'
import { useUiStore } from '@/store/ui'
import { AuthCard, AuthField, Callout, PasswordField, SubmitButton, TextLink } from './AuthParts'

type Method = 'magic' | 'password'
type Mode = 'sign_in' | 'sign_up'

const METHODS: { value: Method; label: string }[] = [
  { value: 'magic', label: 'Magic link' },
  { value: 'password', label: 'Password' },
]

const RESEND_SECONDS = 30
const fade = { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.18, ease: 'easeOut' } } as const

/** Tabs with a sliding active pill; arrow keys move between them (WAI-ARIA tabs pattern). */
function MethodTabs({ value, onChange, panelId }: { value: Method; onChange: (method: Method) => void; panelId: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + METHODS.length) % METHODS.length
    const method = METHODS[next]
    if (!method) return
    onChange(method.value)
    refs.current[next]?.focus()
  }
  const activeIndex = METHODS.findIndex((method) => method.value === value)
  return (
    <div role="tablist" aria-label="Sign-in method" className="relative flex rounded-md border border-line bg-sunken p-0.5">
      {/* Slides with a transform relative to the track, so it stays put when the card resizes. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-sm border border-line-strong bg-raised shadow-card transition-transform duration-base ease-out"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {METHODS.map((method, index) => {
        const active = method.value === value
        return (
          <button
            key={method.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="tab"
            id={`${panelId}-tab-${method.value}`}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(method.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              'relative flex-1 rounded-sm px-3 py-1.5 text-sm transition-colors',
              active ? 'font-medium text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {method.label}
          </button>
        )
      })}
    </div>
  )
}

function useCountdown(initial: number): [number, () => void] {
  const [seconds, setSeconds] = useState(initial)
  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds((current) => current - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])
  return [seconds, () => setSeconds(RESEND_SECONDS)]
}

function InboxNotice({ email, onResend, onBack }: { email: string; onResend: () => Promise<AuthFailure | null>; onBack: () => void }) {
  // The first link was just sent, so the cooldown starts immediately.
  const [cooldown, restart] = useCountdown(RESEND_SECONDS)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<AuthFailure | null>(null)

  const resend = async () => {
    setPending(true)
    setError(await onResend())
    setPending(false)
    restart()
  }

  return (
    <motion.div {...fade} className="flex flex-col items-center text-center" role="status">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-accent/20 bg-accent-soft text-accent">
        <Icon icon={MailCheck} size={22} />
      </span>
      <h2 className="font-display text-lg text-fg">Check your inbox</h2>
      <p className="mt-1.5 text-pretty text-base text-fg-muted">
        We sent a link to <span className="font-medium text-fg">{email}</span>. Open it on this device to continue.
      </p>
      {error && (
        <div className="mt-4 w-full text-left">
          <Callout tone="error">{error.message}</Callout>
        </div>
      )}
      <div className="mt-6 flex w-full flex-col gap-2">
        <Button onClick={() => void resend()} disabled={pending || cooldown > 0} className="w-full">
          {cooldown > 0 ? `Resend in ${cooldown}s` : pending ? 'Sending…' : 'Resend link'}
        </Button>
        <Button variant="ghost" onClick={onBack} className="w-full">
          Use a different email
        </Button>
      </div>
    </motion.div>
  )
}

export function AuthScreen() {
  const session = useSession()
  const online = useOnline()
  const pushToast = useUiStore((state) => state.pushToast)
  const panelId = useId()

  const [method, setMethod] = useState<Method>('magic')
  const [mode, setMode] = useState<Mode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
