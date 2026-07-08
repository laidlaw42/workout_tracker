import { describe, it, expect } from 'vitest'
import { setWeightLabel } from './bodyweight'

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
