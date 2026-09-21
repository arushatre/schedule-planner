import { describe, expect, it } from 'vitest'

import { matchShortcut, isTypingTarget } from './shortcuts'

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
})
const idle = { typing: false, modalOpen: false }

describe('matchShortcut', () => {
  it('maps the documented keys', () => {
    expect(matchShortcut(key('n'), idle)).toBe('new')
    expect(matchShortcut(key('/'), idle)).toBe('search')
    expect(matchShortcut(key('e'), idle)).toBe('edit')
    expect(matchShortcut(key('?'), idle)).toBe('help')
  })

  it('is case-insensitive so Caps Lock does not break it', () => {
    expect(matchShortcut(key('N'), idle)).toBe('new')
  })

  it('leaves keys alone while typing or when a dialog is open', () => {
    expect(matchShortcut(key('n'), { typing: true, modalOpen: false })).toBeNull()
    expect(matchShortcut(key('n'), { typing: false, modalOpen: true })).toBeNull()
  })

  it('never hijacks browser shortcuts with modifiers', () => {
    expect(matchShortcut(key('n', { ctrlKey: true }), idle)).toBeNull()
    expect(matchShortcut(key('e', { metaKey: true }), idle)).toBeNull()
    expect(matchShortcut(key('/', { altKey: true }), idle)).toBeNull()
  })

  it('ignores unrelated keys', () => {
    expect(matchShortcut(key('x'), idle)).toBeNull()
  })
})

describe('isTypingTarget', () => {
  it('detects text fields but not buttons', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('button'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
