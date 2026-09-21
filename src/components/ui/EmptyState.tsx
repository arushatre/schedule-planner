import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Icon } from './Icon'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-raised text-fg-muted shadow-card">
        <Icon icon={icon} size={22} />
      </span>
      <h2 className="font-display text-lg text-fg">{title}</h2>
      <p className="mt-1 text-base text-fg-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
