// The curated category palette. Classes are spelled out as literals so
// Tailwind's scanner finds them; never build `bg-cat-${key}` dynamically.
export const PALETTE_KEYS = [
  'clay',
  'moss',
  'slate',
  'plum',
  'ochre',
  'teal',
  'rose',
  'graphite',
] as const

export type PaletteKey = (typeof PALETTE_KEYS)[number]

interface PaletteEntry {
  label: string
  /** Solid fill: swatches, chip bars, dots. */
  solid: string
  /** Tinted chip background. */
  tint: string
  /** Chip border. */
  border: string
  /** Stronger border, used for dashed class blocks. */
  edge: string
  /** Text/icon color. */
  ink: string
}

export const PALETTE: Record<PaletteKey, PaletteEntry> = {
  clay: {
    label: 'Clay',
    solid: 'bg-cat-clay',
    tint: 'bg-cat-clay/15',
    border: 'border-cat-clay/30',
    edge: 'border-cat-clay/70',
    ink: 'text-cat-clay',
  },
  moss: {
    label: 'Moss',
    solid: 'bg-cat-moss',
    tint: 'bg-cat-moss/15',
    border: 'border-cat-moss/30',
    edge: 'border-cat-moss/70',
    ink: 'text-cat-moss',
  },
  slate: {
    label: 'Slate',
    solid: 'bg-cat-slate',
    tint: 'bg-cat-slate/15',
    border: 'border-cat-slate/30',
    edge: 'border-cat-slate/70',
    ink: 'text-cat-slate',
  },
  plum: {
    label: 'Plum',
    solid: 'bg-cat-plum',
    tint: 'bg-cat-plum/15',
    border: 'border-cat-plum/30',
    edge: 'border-cat-plum/70',
    ink: 'text-cat-plum',
  },
  ochre: {
    label: 'Ochre',
    solid: 'bg-cat-ochre',
    tint: 'bg-cat-ochre/15',
    border: 'border-cat-ochre/30',
    edge: 'border-cat-ochre/70',
    ink: 'text-cat-ochre',
  },
  teal: {
    label: 'Teal',
    solid: 'bg-cat-teal',
    tint: 'bg-cat-teal/15',
    border: 'border-cat-teal/30',
    edge: 'border-cat-teal/70',
    ink: 'text-cat-teal',
  },
  rose: {
    label: 'Rose',
    solid: 'bg-cat-rose',
    tint: 'bg-cat-rose/15',
    border: 'border-cat-rose/30',
    edge: 'border-cat-rose/70',
    ink: 'text-cat-rose',
  },
  graphite: {
    label: 'Graphite',
    solid: 'bg-cat-graphite',
    tint: 'bg-cat-graphite/15',
    border: 'border-cat-graphite/30',
    edge: 'border-cat-graphite/70',
    ink: 'text-cat-graphite',
  },
}
