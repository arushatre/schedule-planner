import { describe, expect, it } from 'vitest'

import { DEFAULT_APPEARANCE, PRESETS, appearanceCss, parseAppearance, tokensFor } from './appearance'

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
