import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

import { cx } from '@/lib/cx'
import { Icon } from './Icon'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
}

// Hover/active feedback is a background tint or border shift, never a glow.
const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-fg border-accent shadow-lift hover:bg-accent-hover hover:border-accent-hover',
  secondary:
    'bg-raised text-fg border-line-strong shadow-card hover:bg-panel hover:border-fg-subtle',
  ghost: 'bg-transparent text-fg-muted border-transparent hover:bg-sunken hover:text-fg',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-base gap-2',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center rounded-md border font-medium',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon && <Icon icon={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  )
}
