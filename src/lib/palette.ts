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
}

export const PALETTE: Record<PaletteKey, PaletteEntry> = {
  clay: { label: 'Clay', solid: 'bg-cat-clay', tint: 'bg-cat-clay/15', border: 'border-cat-clay/30' },
  moss: { label: 'Moss', solid: 'bg-cat-moss', tint: 'bg-cat-moss/15', border: 'border-cat-moss/30' },
  slate: {
    label: 'Slate',
    solid: 'bg-cat-slate',
    tint: 'bg-cat-slate/15',
    border: 'border-cat-slate/30',
  },
  plum: { label: 'Plum', solid: 'bg-cat-plum', tint: 'bg-cat-plum/15', border: 'border-cat-plum/30' },
  ochre: {
    label: 'Ochre',
    solid: 'bg-cat-ochre',
    tint: 'bg-cat-ochre/15',
    border: 'border-cat-ochre/30',
  },
  teal: { label: 'Teal', solid: 'bg-cat-teal', tint: 'bg-cat-teal/15', border: 'border-cat-teal/30' },
  rose: { label: 'Rose', solid: 'bg-cat-rose', tint: 'bg-cat-rose/15', border: 'border-cat-rose/30' },
  graphite: {
    label: 'Graphite',
    solid: 'bg-cat-graphite',
    tint: 'bg-cat-graphite/15',
    border: 'border-cat-graphite/30',
  },
}
