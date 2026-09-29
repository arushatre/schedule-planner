import { CalendarCheck, CircleAlert, CircleCheck, Eye, EyeOff, Info, LoaderCircle } from 'lucide-react'
import { useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'

/** Centered, raised card on the app's paper canvas (ported from 21st.dev "login-06"). */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-line bg-raised px-6 pb-8 pt-9 shadow-pop sm:px-8">
          <div className="flex flex-col items-center text-center">
            <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-md border border-accent/20 bg-accent-soft text-accent">
              <Icon icon={CalendarCheck} size={22} />
            </span>
            <div className="mb-1 font-display text-md text-fg-muted">Daybook</div>
            <h1 className="text-balance font-display text-xl text-fg">{title}</h1>
            {subtitle && <p className="mt-2 text-pretty text-base text-fg-muted">{subtitle}</p>}
          </div>
          <div className="mt-7">{children}</div>
        </div>
        <p className="mt-5 text-center text-sm text-fg-subtle">Your tasks sync to your account and stay available offline.</p>
      </div>
    </main>
  )
}

const inputBase =
  'h-10 w-full rounded-md border bg-raised px-3 text-base shadow-inset transition-colors placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-60'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error: string | null
  hint?: string
  trailing?: ReactNode
  labelAside?: ReactNode
}

/** Labelled input with inline validation wired to aria-invalid / aria-describedby. */
export function AuthField({ label, error, hint, trailing, labelAside, className, ...rest }: FieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-fg-muted">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cx(
            inputBase,
            error ? 'border-overdue hover:border-overdue focus:border-overdue' : 'border-line-strong hover:border-fg-subtle focus:border-accent',
            trailing ? 'pr-10' : undefined,
            className,
          )}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {message && (
        <p id={messageId} className={cx('mt-1.5 text-sm', error ? 'text-overdue' : 'text-fg-subtle')}>
          {message}
        </p>
      )}
    </div>
  )
}

export function PasswordField(props: Omit<FieldProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false)
  return (
    <AuthField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          disabled={props.disabled}
          className="rounded-sm p-1.5 text-fg-subtle transition-colors hover:bg-sunken hover:text-fg"
        >
          <Icon icon={visible ? EyeOff : Eye} size={16} />
        </button>
      }
    />
  )
}

type CalloutTone = 'error' | 'success' | 'info'

const TONE: Record<CalloutTone, { icon: LucideIcon; className: string }> = {
  error: { icon: CircleAlert, className: 'border-overdue/30 bg-overdue-soft [&_svg]:text-overdue' },
  success: { icon: CircleCheck, className: 'border-accent/25 bg-accent-soft [&_svg]:text-accent' },
  info: { icon: Info, className: 'border-line-strong bg-sunken [&_svg]:text-fg-muted' },
}

export function Callout({ tone, children, action }: { tone: CalloutTone; children: ReactNode; action?: ReactNode }) {
  const { icon, className } = TONE[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('flex gap-2.5 rounded-md border px-3 py-2.5 text-base text-fg', className)}
    >
      <Icon icon={icon} size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {children}
        {action && <div className="mt-1.5">{action}</div>}
      </div>
    </div>
  )
}

/** Full-width primary button that swaps to a spinner and a verb label while pending. */
export function SubmitButton({ pending, pendingLabel, children }: { pending: boolean; pendingLabel: string; children: ReactNode }) {
  return (
    <Button type="submit" variant="primary" className="w-full" disabled={pending} aria-disabled={pending}>
      {pending ? (
        <>
          <Icon icon={LoaderCircle} size={18} className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

export function TextLink({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-sm text-sm font-medium text-accent underline-offset-2 transition-colors hover:text-accent-hover hover:underline disabled:opacity-50"
    >
      {children}
    </button>
  )
}
