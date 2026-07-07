import { describe, it, expect } from 'vitest'
import { contrastText, gradeToColor, vGradeToColor } from './gradeColors'

const HEX = /^#[0-9a-f]{6}$/

describe('contrastText', () => {
  it('picks dark text on a light background and vice-versa', () => {
    expect(contrastText('#ffffff')).toBe('#0a0a0a')
    expect(contrastText('#000000')).toBe('#fafafa')
  })
})

describe('vGradeToColor', () => {
  it('anchors the band endpoints', () => {
    expect(vGradeToColor('VB-')).toBe('#4ade80') // green band start
    expect(vGradeToColor('V17')).toBe('#86198f') // magenta band end
  })
  it('returns a valid hex for every known grade', () => {
    for (const g of ['VB', 'V0', 'V1', 'V5', 'V10', 'V13']) {
      expect(vGradeToColor(g)).toMatch(HEX)
    }
  })
  it('falls back to neutral grey for an unknown grade', () => {
    expect(vGradeToColor('V99')).toBe('#9ca3af')
  })
})

describe('gradeToColor', () => {
  it('maps the absolute scale ends green → magenta', () => {
    expect(gradeToColor(1)).toBe('#4ade80')
    expect(gradeToColor(35)).toBe('#86198f')
  })
  it('honours a gym range so the lowest is green and highest magenta', () => {
    expect(gradeToColor(3, { min: 3, max: 10 })).toBe('#4ade80')
    expect(gradeToColor(10, { min: 3, max: 10 })).toBe('#86198f')
  })
  it('returns a valid hex mid-scale', () => {
    expect(gradeToColor(18)).toMatch(HEX)
  })
})
