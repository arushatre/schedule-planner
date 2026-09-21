import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, getMonth, startOfMonth, startOfWeek } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { useOutsidePointer } from '@/hooks/useOutsidePointer'
import { WEEK_OPTIONS, fromDateStr, toDateStr, todayStr } from '@/lib/dates'
import { cx } from '@/lib/cx'
import { Button } from './Button'
import { Icon } from './Icon'

interface DatePickerProps {
  value: string | null
  onChange: (value: string | null) => void
  ariaLabel: string
  placeholder?: string
  clearable?: boolean
  className?: string
}

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// Fully custom picker: the native date input's popup can't follow the design system.
export function DatePicker({
  value,
  onChange,
  ariaLabel,
  placeholder = 'Pick a date',
  clearable = true,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(value ? fromDateStr(value) : new Date()))
  const rootRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useOutsidePointer(rootRef, open, close)

  const today = todayStr()
  const days = eachDayOfInterval({
    start: startOfWeek(month, WEEK_OPTIONS),
    end: endOfWeek(endOfMonth(month), WEEK_OPTIONS),
  })

  const toggle = () => {
    if (!open) setMonth(startOfMonth(value ? fromDateStr(value) : new Date()))
    setOpen(!open)
  }

  const pick = (date: string | null) => {
    onChange(date)
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (open && event.key === 'Escape') {
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={cx('relative', className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
        className={cx(
          'flex h-10 w-full items-center gap-2 rounded-md border bg-raised px-3 text-left text-base shadow-inset transition-colors hover:border-fg-subtle',
          open ? 'border-accent' : 'border-line-strong',
        )}
      >
        <Icon icon={CalendarDays} size={16} className="shrink-0 text-fg-subtle" />
        <span className={cx('truncate', !value && 'text-fg-subtle')}>
          {value ? format(fromDateStr(value), 'EEE, MMM d, yyyy') : placeholder}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${ariaLabel} calendar`}
          className="absolute z-30 mt-1 w-72 rounded-md border border-line-strong bg-raised p-3 shadow-pop"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(addMonths(month, -1))}
              className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-sunken hover:text-fg"
            >
              <Icon icon={ChevronLeft} size={16} />
            </button>
            <span className="font-display text-md" aria-live="polite">
              {format(month, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(addMonths(month, 1))}
              className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-sunken hover:text-fg"
            >
              <Icon icon={ChevronRight} size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-fg-subtle">
            {WEEKDAY_INITIALS.map((initial, index) => (
              <span key={index} className="py-1">
                {initial}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const key = toDateStr(day)
              const selected = key === value
              const inMonth = getMonth(day) === getMonth(month)
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={format(day, 'EEEE, MMMM d, yyyy')}
                  aria-pressed={selected}
                  onClick={() => pick(key)}
                  className={cx(
                    'tabular h-9 rounded-md border text-sm transition-colors',
                    selected
                      ? 'border-accent bg-accent text-accent-fg'
                      : key === today
                        ? 'border-accent/50 text-accent hover:bg-accent-soft'
                        : 'border-transparent hover:bg-sunken',
                    !inMonth && !selected && 'text-fg-subtle',
                  )}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2">
            <Button size="sm" variant="ghost" onClick={() => pick(today)}>
              Today
            </Button>
            {clearable && (
              <Button size="sm" variant="ghost" onClick={() => pick(null)}>
                Clear
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
