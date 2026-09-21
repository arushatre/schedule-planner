import { Check, Minus } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { cx } from '@/lib/cx'
import { Icon } from './Icon'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Visible label. Omit for icon-only rows and pass `ariaLabel` instead. */
  label?: string
  ariaLabel?: string
  indeterminate?: boolean
  disabled?: boolean
  className?: string
}

// A real <input type="checkbox"> kept accessible but visually hidden; the box
// beside it is fully custom so no browser-default control ever shows.
export function Checkbox({
  checked,
  onChange,
  label,
  ariaLabel,
  indeterminate = false,
  disabled = false,
  className,
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  const filled = checked || indeterminate

  return (
    <label
      className={cx(
        'inline-flex items-center gap-2.5 select-none',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-label={label ? undefined : ariaLabel}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cx(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border',
          'transition-colors',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          filled
            ? 'border-accent bg-accent text-accent-fg peer-hover:bg-accent-hover'
            : 'border-line-strong bg-raised shadow-inset peer-hover:border-fg-subtle peer-hover:bg-panel',
        )}
      >
        {checked && !indeterminate && <Icon icon={Check} size={13} />}
        {indeterminate && <Icon icon={Minus} size={13} />}
      </span>
      {label && <span className="text-base text-fg">{label}</span>}
    </label>
  )
}
