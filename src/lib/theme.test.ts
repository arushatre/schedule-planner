import { describe, expect, it } from 'vitest'

import { applyTheme, isThemePreference, resolveTheme } from './theme'

describe('theme', () => {
  it('follows the system only when the preference is "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('validates stored values', () => {
    expect(isThemePreference('dark')).toBe(true)
    expect(isThemePreference('sepia')).toBe(false)
    expect(isThemePreference(null)).toBe(false)
  })

  it('applies the theme to the root element and the browser chrome color', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#000">'
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#1E1C19')
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
