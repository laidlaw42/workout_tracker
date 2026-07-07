import { describe, it, expect } from 'vitest'
import { repsMet, weightPrValue } from './pr'

describe('repsMet', () => {
  it('an untargeted set always counts', () => {
    expect(repsMet(undefined, undefined)).toBe(true)
    expect(repsMet(undefined, 3)).toBe(true)
  })
  it('meets the target when actual >= target', () => {
    expect(repsMet(10, 10)).toBe(true)
    expect(repsMet(10, 11)).toBe(true)
  })
  it('misses when actual < target or is absent', () => {
    expect(repsMet(10, 9)).toBe(false)
    expect(repsMet(10, undefined)).toBe(false)
  })
})

describe('weightPrValue', () => {
  it('non-loadable uses the entered bar weight', () => {
    expect(weightPrValue(false, { weightKg: 100 })).toBe(100)
    expect(weightPrValue(undefined, { weightKg: 50 })).toBe(50)
    expect(weightPrValue(false, { weightKg: undefined })).toBeUndefined()
  })
  it('loadable compares the added load alone', () => {
    expect(weightPrValue(true, { additionalWeightKg: 10 })).toBe(10)
    expect(weightPrValue(true, { additionalWeightKg: 10, weightKg: 999 })).toBe(10)
  })
  it('loadable with no added load sets no PR', () => {
    expect(weightPrValue(true, { additionalWeightKg: 0 })).toBeUndefined()
    expect(weightPrValue(true, { additionalWeightKg: undefined, weightKg: 100 })).toBeUndefined()
  })
})
