import { describe, it, expect, beforeEach } from 'vitest'
import { boolDefaultOff, boolDefaultOn, getSetting, intSetting, setSetting } from './settingsStore'

// jsdom-free: provide a minimal localStorage stub for the node test env.
beforeEach(() => {
  const store = new Map<string, string>()
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage
})

describe('boolDefaultOn', () => {
  it('is on when unset and only off for "0"', () => {
    const s = boolDefaultOn('flag')
    expect(getSetting(s)).toBe(true)
    setSetting(s, false)
    expect(getSetting(s)).toBe(false)
    setSetting(s, true)
    expect(getSetting(s)).toBe(true)
  })
})

describe('boolDefaultOff', () => {
  it('is off when unset and only on for "1"', () => {
    const s = boolDefaultOff('flag2')
    expect(getSetting(s)).toBe(false)
    setSetting(s, true)
    expect(getSetting(s)).toBe(true)
  })
})

describe('intSetting', () => {
  const s = intSetting('n', 5, 0, 10)
  it('returns the default when unset', () => {
    expect(getSetting(s)).toBe(5)
  })
  it('clamps and rounds on read and write', () => {
    setSetting(s, 12)
    expect(getSetting(s)).toBe(10)
    setSetting(s, -3)
    expect(getSetting(s)).toBe(0)
    setSetting(s, 3.6)
    expect(getSetting(s)).toBe(4)
  })
  it('falls back to the default for a non-numeric stored value', () => {
    localStorage.setItem('n', 'oops')
    expect(getSetting(s)).toBe(5)
  })
})
