import { Platform, useColorScheme } from 'react-native'

import { tokensFor } from '@/lib/appearance'
import type { PaletteKey } from '@/lib/palette'
import { useStore } from './store'

// Mirrors the category colors in src/styles/index.css (muted, never neon).
const CATEGORY: Record<'light' | 'dark', Record<PaletteKey, string>> = {
  light: {
    clay: '186 112 100',
    moss: '84 150 110',
    slate: '95 122 150',
    plum: '139 100 128',
    ochre: '184 146 30',
    teal: '78 138 133',
    rose: '179 111 126',
    graphite: '107 111 118',
  },
  dark: {
    clay: '212 142 128',
    moss: '168 216 185',
    slate: '123 153 183',
    plum: '171 129 159',
    ochre: '246 213 92',
    teal: '103 166 159',
    rose: '201 133 149',
    graphite: '139 144 151',
  },
}

/** "r g b" (the web token format) to an RN color, with optional alpha. */
export const rgb = (triplet: string, alpha = 1) => `rgba(${triplet.split(' ').join(', ')}, ${alpha})`

const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' })

export function useTheme() {
  const system = useColorScheme()
  const { prefs } = useStore()
  const mode = prefs.mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : prefs.mode
  const t = tokensFor(prefs.appearance, mode)
  const c = (key: string) => rgb(t[key] ?? '0 0 0')
  const radius = { sharp: 0.4, soft: 1, round: 1.6 }[prefs.appearance.radius]
  return {
    mode,
    canvas: c('canvas'),
    panel: c('panel'),
    raised: c('raised'),
    sunken: c('sunken'),
    line: c('line'),
    lineStrong: c('line-strong'),
    fg: c('fg'),
    muted: c('fg-muted'),
    subtle: c('fg-subtle'),
    accent: c('accent'),
    accentSoft: c('accent-soft'),
    accentFg: c('accent-fg'),
    overdue: c('overdue'),
    overdueSoft: c('overdue-soft'),
    // Section colors (see src/lib/appearance.ts): quiet washes, 3px edges, text-safe inks.
    frame: c('frame'),
    frameFg: c('frame-fg'),
    sageWash: c('sage-wash'),
    sageEdge: c('sage-edge'),
    mustardWash: c('mustard-wash'),
    mustardEdge: c('mustard-edge'),
    vermilionWash: c('vermilion-wash'),
    vermilionEdge: c('vermilion-edge'),
    edge: (key: 'sage' | 'mustard' | 'vermilion', alpha: number) => rgb(t[`${key}-edge`] ?? '0 0 0', alpha),
    category: (key: PaletteKey) => rgb(CATEGORY[mode][key]),
    radius: (px: number) => px * radius,
    serif: ['fraunces', 'newYork'].includes(prefs.appearance.displayFont) ? SERIF : undefined,
    textScale: { compact: 0.94, regular: 1, large: 1.1 }[prefs.appearance.textSize],
  }
}

export type Theme = ReturnType<typeof useTheme>
