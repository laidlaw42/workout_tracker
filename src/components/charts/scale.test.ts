import { describe, it, expect } from 'vitest'
import { intTicks, niceTicks, thinLabels } from './scale'

describe('niceTicks', () => {
  it('produces round bounds and evenly-spaced ticks over a range', () => {
    const { min, max, ticks } = niceTicks(2, 97)
    expect(min).toBeLessThanOrEqual(2)
    expect(max).toBeGreaterThanOrEqual(97)
    // ticks are sorted, unique, evenly spaced
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1])
    }
    const step = ticks[1] - ticks[0]
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeCloseTo(step, 6)
    }
    expect(ticks[0]).toBe(min)
    expect(ticks[ticks.length - 1]).toBe(max)
  })

  it('does not force zero — it zooms to the data range', () => {
    const { min } = niceTicks(55, 65)
    expect(min).toBeGreaterThan(0)
  })

  it('pads a flat series so it renders centred, not divide-by-zero', () => {
    const { min, max, ticks } = niceTicks(60, 60)
    expect(min).toBeLessThan(60)
    expect(max).toBeGreaterThan(60)
    expect(ticks.length).toBeGreaterThanOrEqual(2)
  })

  it('handles a flat zero series', () => {
    const { min, max } = niceTicks(0, 0)
    expect(min).toBeLessThanOrEqual(0)
    expect(max).toBeGreaterThanOrEqual(0)
    expect(max).toBeGreaterThan(min)
  })

  it('avoids floating-point noise in tick values', () => {
    const { ticks } = niceTicks(0, 1, 5)
    for (const t of ticks) {
      // no long fractional tails like 0.30000000000000004
      expect(String(t).replace('-', '').replace('.', '').length).toBeLessThanOrEqual(4)
    }
  })

  it('swaps reversed inputs', () => {
    expect(niceTicks(100, 10)).toEqual(niceTicks(10, 100))
  })

  it('is finite-safe', () => {
    expect(niceTicks(NaN, 5)).toEqual({ min: 0, max: 1, ticks: [0, 1] })
  })
})

describe('intTicks', () => {
  it('gives one tick per integer for small counts', () => {
    expect(intTicks(3)).toEqual({ max: 3, ticks: [0, 1, 2, 3] })
  })
  it('always starts at zero and only whole numbers', () => {
    const { max, ticks } = intTicks(23)
    expect(ticks[0]).toBe(0)
    expect(max).toBeGreaterThanOrEqual(23)
    for (const t of ticks) expect(Number.isInteger(t)).toBe(true)
  })
  it('never returns a zero max', () => {
    expect(intTicks(0).max).toBe(1)
  })
})

describe('thinLabels', () => {
  it('shows all when they fit', () => {
    expect(thinLabels(4, 6)).toEqual([0, 1, 2, 3])
  })
  it('always includes first and last', () => {
    const idx = thinLabels(20, 5)
    expect(idx[0]).toBe(0)
    expect(idx[idx.length - 1]).toBe(19)
    expect(idx.length).toBeLessThanOrEqual(5)
  })
  it('handles single and empty', () => {
    expect(thinLabels(1, 5)).toEqual([0])
    expect(thinLabels(0, 5)).toEqual([])
  })
  it('returns strictly increasing unique indices', () => {
    const idx = thinLabels(100, 7)
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThan(idx[i - 1])
  })
})
