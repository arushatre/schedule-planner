import { describe, expect, it } from 'vitest'

import { ACCENTS, DEFAULT_APPEARANCE, PRESETS, appearanceCss, contrast, parseAppearance, tokensFor } from './appearance'
import type { AccentKey } from './appearance'

const luminance = (triplet: string) => {
  const [r = 0, g = 0, b = 0] = triplet.split(' ').map(Number)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

describe('appearance', () => {
  it('falls back field-by-field for missing, unknown or corrupt values', () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE)
    expect(parseAppearance('not json')).toEqual(DEFAULT_APPEARANCE)
    expect(parseAppearance('{"accent":"jade","tone":"neon"}')).toEqual({ ...DEFAULT_APPEARANCE, accent: 'jade' })
  })

  it('keeps text readable against the canvas in both modes for every preset', () => {
    for (const { value } of PRESETS) {
      const light = tokensFor(value, 'light')
      const dark = tokensFor(value, 'dark')
      expect(luminance(light.canvas!) - luminance(light.fg!)).toBeGreaterThan(150)
      expect(luminance(dark.fg!) - luminance(dark.canvas!)).toBeGreaterThan(150)
    }
  })

  it('emits light and dark blocks plus font, radius and size settings', () => {
    const css = appearanceCss(DEFAULT_APPEARANCE)
    expect(css).toContain(":root[data-theme='dark']")
    expect(css).toMatch(/--accent: \d+ \d+ \d+;/)
    expect(css).toContain('--radius-scale: 1;')
    expect(css).toContain('font-size: 100%')
  })
})

describe('frame and overdue colors', () => {
  const rgb = (triplet: string) => triplet.split(' ').map(Number) as [number, number, number]
  const looks = [...PRESETS.map((p) => p.value), ...Object.keys(ACCENTS).map((accent) => ({ ...DEFAULT_APPEARANCE, accent: accent as AccentKey }))]

  it('keeps overdue and frame text readable in every preset and mode', () => {
    for (const look of looks) {
      for (const mode of ['light', 'dark'] as const) {
        const t = tokensFor(look, mode)
        expect(contrast(rgb(t.fg!), rgb(t['overdue-soft']!))).toBeGreaterThanOrEqual(4.5)
        expect(contrast(rgb(t.overdue!), rgb(t.raised!))).toBeGreaterThanOrEqual(4.5)
        expect(contrast(rgb(t['frame-fg']!), rgb(t.frame!))).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('never emits glow tokens', () => {
    expect(appearanceCss(DEFAULT_APPEARANCE)).not.toMatch(/glow/)
  })
})
