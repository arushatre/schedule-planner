import { ClockAlert } from 'lucide-react'

import { cx } from '@/lib/cx'
import { PALETTE } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'
import { Icon } from './Icon'

interface ChipProps {
  label: string
  color: PaletteKey
  time?: string
  overdue?: boolean
  done?: boolean
  className?: string
}

// Calendar chip: category-tinted fill with a solid left bar. Overdue swaps the
// bar for a hatched edge, warms the tint and adds an icon: shape, not just hue.
export function Chip({ label, color, time, overdue = false, done = false, className }: ChipProps) {
  const palette = PALETTE[color]
  return (
    <div
      className={cx(
        'flex min-w-0 items-center gap-1.5 overflow-hidden rounded-sm border pr-1.5 text-sm',
        overdue ? 'border-overdue/40 bg-overdue-soft' : cx(palette.tint, palette.border),
        done && 'opacity-60',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx('h-6 shrink-0', overdue ? 'overdue-edge w-1.5' : cx('w-1', palette.solid))}
      />
      {overdue && <Icon icon={ClockAlert} size={13} className="shrink-0 text-overdue" />}
      {time && <span className="tabular shrink-0 text-xs text-fg-muted">{time}</span>}
      <span className={cx('truncate', done && 'line-through')}>{label}</span>
    </div>
  )
}
