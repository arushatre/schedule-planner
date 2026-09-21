import { GraduationCap } from 'lucide-react'

import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'
import { formatTime } from '@/lib/dates'
import { PALETTE } from '@/lib/palette'
import { formatBlockTimes } from '@/lib/schedule'
import { useUiStore } from '@/store/ui'
import type { ClassBlock } from '@/types/model'

/**
 * Class blocks are the fixed weekly schedule. They read as scenery behind the
 * tasks: dashed outline, no fill, a mortarboard icon, never draggable.
 */
export function ClassChip({ block }: { block: ClassBlock }) {
  const openDialog = useUiStore((state) => state.openDialog)
  const palette = PALETTE[block.colorKey]
  return (
    <button
      type="button"
      onClick={() => openDialog('schedule')}
      title={`${block.title}, ${formatBlockTimes(block)}${block.location ? `, ${block.location}` : ''}`}
      className={cx(
        'flex min-w-0 items-center gap-1.5 rounded-sm border border-dashed bg-transparent px-1.5 py-0.5 text-left text-sm transition-colors hover:bg-sunken',
        palette.edge,
      )}
    >
      <Icon icon={GraduationCap} size={13} className={cx('shrink-0', palette.ink)} />
      <span className="tabular shrink-0 text-xs text-fg-muted">{formatTime(block.startTime)}</span>
      <span className="truncate text-fg-muted">{block.title}</span>
    </button>
  )
}

export function ClassRow({ block }: { block: ClassBlock }) {
  const openDialog = useUiStore((state) => state.openDialog)
  const palette = PALETTE[block.colorKey]
  return (
    <button
      type="button"
      onClick={() => openDialog('schedule')}
      className={cx(
        'flex w-full items-center gap-3 rounded-md border border-dashed bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-sunken',
        palette.edge,
      )}
    >
      <Icon icon={GraduationCap} className={cx('shrink-0', palette.ink)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base">{block.title}</span>
        <span className="tabular block truncate text-sm text-fg-muted">
          {formatBlockTimes(block)}
          {block.location ? ` · ${block.location}` : ''}
        </span>
      </span>
      <span className="text-xs uppercase tracking-wide text-fg-subtle">Class</span>
    </button>
  )
}
