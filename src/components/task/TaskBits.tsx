import { SignalHigh, SignalLow, SignalMedium } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'
import { PALETTE } from '@/lib/palette'
import type { PaletteKey } from '@/lib/palette'
import { PRIORITY_LABEL } from '@/types/model'
import type { Priority } from '@/types/model'

export function CategoryDot({ color, className }: { color: PaletteKey; className?: string }) {
  return <span aria-hidden="true" className={cx('h-2.5 w-2.5 shrink-0 rounded-full', PALETTE[color].solid, className)} />
}

const PRIORITY_ICON: Record<Priority, LucideIcon> = {
  low: SignalLow,
  medium: SignalMedium,
  high: SignalHigh,
}

export function PriorityMark({ priority }: { priority: Priority }) {
  return (
    <span
      title={`${PRIORITY_LABEL[priority]} priority`}
      className={cx('shrink-0', priority === 'high' ? 'text-fg' : 'text-fg-subtle')}
    >
      <Icon icon={PRIORITY_ICON[priority]} size={16} />
      <span className="sr-only">{PRIORITY_LABEL[priority]} priority</span>
    </span>
  )
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
      <span className="h-1 w-10 overflow-hidden rounded-full bg-sunken">
        <span
          className="block h-full rounded-full bg-accent transition-[width] duration-200"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </span>
      <span className="tabular">
        {done}/{total}
      </span>
      <span className="sr-only">subtasks done</span>
    </span>
  )
}
