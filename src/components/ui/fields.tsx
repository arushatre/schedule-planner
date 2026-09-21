import { X } from 'lucide-react'
import { useState } from 'react'
import type { InputHTMLAttributes, KeyboardEvent, ReactNode, TextareaHTMLAttributes } from 'react'

import { cx } from '@/lib/cx'
import { Icon } from './Icon'

const control =
  'w-full rounded-md border border-line-strong bg-raised px-3 text-base shadow-inset transition-colors placeholder:text-fg-subtle hover:border-fg-subtle focus:border-accent'

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" className={cx(control, 'h-10', className)} {...rest} />
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, 'min-h-[5rem] resize-y py-2', className)} {...rest} />
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-fg-muted">{label}</div>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-sm text-overdue">
          {error}
        </p>
      )}
    </div>
  )
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel, className }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx('inline-flex rounded-md border border-line bg-sunken p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex-1 rounded-sm border px-3 py-1.5 text-sm transition-colors',
              active
                ? 'border-line-strong bg-raised font-medium text-fg shadow-card'
                : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Toggle pill used by filters and weekday pickers. */
export function Pill({
  pressed,
  onClick,
  children,
  className,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
        pressed
          ? 'border-accent/40 bg-accent-soft text-accent'
          : 'border-line-strong bg-raised text-fg-muted hover:border-fg-subtle hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const tag = draft.trim().replace(/^#/, '').toLowerCase()
    setDraft('')
    if (tag && !value.includes(tag)) onChange([...value, tag])
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className={cx(control, 'flex min-h-10 flex-wrap items-center gap-1.5 py-1.5 focus-within:border-accent')}>
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-panel py-0.5 pl-2.5 pr-1 text-sm"
        >
          #{tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            onClick={() => onChange(value.filter((existing) => existing !== tag))}
            className="rounded-full p-0.5 text-fg-subtle transition-colors hover:bg-sunken hover:text-fg"
          >
            <Icon icon={X} size={12} />
          </button>
        </span>
      ))}
      <input
        aria-label="Add tag"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length ? '' : 'Add tags…'}
        className="min-w-[6rem] flex-1 bg-transparent py-0.5 outline-none placeholder:text-fg-subtle"
      />
    </div>
  )
}
