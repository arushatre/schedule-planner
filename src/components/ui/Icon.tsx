import type { LucideIcon } from 'lucide-react'

interface IconProps {
  icon: LucideIcon
  size?: number
  className?: string
}

// Single choke point so every icon in the app shares one stroke weight.
export function Icon({ icon: Glyph, size = 18, className }: IconProps) {
  return <Glyph size={size} strokeWidth={1.75} className={className} aria-hidden="true" />
}
