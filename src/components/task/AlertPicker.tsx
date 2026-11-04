import { Bell } from 'lucide-react'

import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'
import { ALERT_OFFSETS, alertLabel } from '@/lib/reminders'

interface AlertPickerProps {
  value: number[]
  onChange: (alerts: number[]) => void
  /** Untimed tasks count as due at 9:00, which the hint explains. */
  timed: boolean
}

/** Toggle chips for "notify me N before it's due"; any number can be on. */
export function AlertPicker({ value, onChange, timed }: AlertPickerProps) {
  const toggle = (minutes: number) =>
    onChange(value.includes(minutes) ? value.filter((m) => m !== minutes) : [...value, minutes].sort((a, b) => a - b))

  return (
    <div className="grid gap-2">
      <div role="group" aria-label="Alerts" className="flex flex-wrap gap-2">
        {ALERT_OFFSETS.map((minutes) => {
          const on = value.includes(minutes)
          return (
            <button
              key={minutes}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(minutes)}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                on ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-raised text-fg-muted hover:bg-sunken hover:text-fg',
              )}
            >
              {on && <Icon icon={Bell} size={14} />}
              {alertLabel(minutes)}
            </button>
          )
        })}
      </div>
      {!timed && value.length > 0 && (
        <p className="text-sm text-fg-subtle">No due time set, so alerts count from 9:00 AM on the due date.</p>
      )}
    </div>
  )
}
