import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { bodyweightLoadPct, setWeightLabel } from './bodyweight'

describe('setWeightLabel', () => {
  it('plain barbell weight reads as its bar weight', () => {
    expect(setWeightLabel({ weightKg: 60 })).toBe('60 kg')
    expect(setWeightLabel({ weightKg: 0 })).toBe('0 kg')
  })
  it('an unloaded bodyweight set reads BW', () => {
    expect(setWeightLabel({})).toBe('BW')
    expect(setWeightLabel({ additionalWeightKg: 0 })).toBe('BW')
  })
  it('added load reads BW +N kg', () => {
    expect(setWeightLabel({ additionalWeightKg: 10 })).toBe('BW +10 kg')
    expect(setWeightLabel({ additionalWeightKg: 2.5 })).toBe('BW +2.5 kg')
  })
  it('assisted load reads BW -N kg', () => {
    expect(setWeightLabel({ additionalWeightKg: -20 })).toBe('BW -20 kg')
  })
  it('additional load wins over an incidental primary weight', () => {
    expect(setWeightLabel({ weightKg: 999, additionalWeightKg: -5 })).toBe('BW -5 kg')
  })
})

describe('bodyweightLoadPct', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('is null when no bodyweight is set', () => {
    expect(bodyweightLoadPct(10)).toBeNull()
  })
  it('a plain-bodyweight effort (0 load) reads 100%', () => {
    localStorage.setItem('bodyweight', '70')
    expect(bodyweightLoadPct(0)).toBe(100)
  })
  it('added load reads above 100%', () => {
    localStorage.setItem('bodyweight', '70')
    expect(bodyweightLoadPct(7)).toBe(110)
  })
  it('assisted load reads below 100%', () => {
    localStorage.setItem('bodyweight', '70')
    expect(bodyweightLoadPct(-20)).toBe(71) // 50 / 70 → 71.4 → 71
  })
  it('is null when assistance meets or exceeds bodyweight (non-physical)', () => {
    localStorage.setItem('bodyweight', '70')
    expect(bodyweightLoadPct(-70)).toBeNull()
    expect(bodyweightLoadPct(-80)).toBeNull()
  })
})
