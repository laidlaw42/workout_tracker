import { describe, it, expect } from 'vitest'
import { isCleanTick, vGradeFromIndex, vGradeIndex } from './climbing'

describe('vGradeIndex', () => {
  it('maps whole grades to integers (VB = -1)', () => {
    expect(vGradeIndex('VB')).toBe(-1)
    expect(vGradeIndex('V0')).toBe(0)
    expect(vGradeIndex('V5')).toBe(5)
    expect(vGradeIndex('V17')).toBe(17)
  })
  it('offsets sub-grades by ±0.33', () => {
    expect(vGradeIndex('VB-')).toBeCloseTo(-1.33)
    expect(vGradeIndex('VB+')).toBeCloseTo(-0.67)
    expect(vGradeIndex('V0-')).toBeCloseTo(-0.33)
    expect(vGradeIndex('V0+')).toBeCloseTo(0.33)
  })
  it('falls back to -1 for an unparseable grade', () => {
    expect(vGradeIndex('nonsense')).toBe(-1)
  })
})

describe('vGradeFromIndex round-trips whole grades', () => {
  it.each(['VB', 'V0', 'V3', 'V10', 'V17'])('%s', (g) => {
    expect(vGradeFromIndex(vGradeIndex(g))).toBe(g)
  })
  it('recovers sub-grades on VB/V0', () => {
    expect(vGradeFromIndex(vGradeIndex('VB-'))).toBe('VB-')
    expect(vGradeFromIndex(vGradeIndex('V0+'))).toBe('V0+')
  })
})

describe('isCleanTick', () => {
  it('recognises clean ticks', () => {
    for (const t of ['onsight', 'flash', 'send', 'clean', 'redpoint', 'pink_point'] as const) {
      expect(isCleanTick(t)).toBe(true)
    }
  })
  it('rejects non-clean ticks', () => {
    for (const t of ['working', 'attempt', 'hang_dog', 'dab', 'retreat', 'repeat'] as const) {
      expect(isCleanTick(t)).toBe(false)
    }
  })
})
