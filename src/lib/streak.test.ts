import { describe, it, expect } from 'vitest'
import { computeStreak } from './streak'

const now = new Date(2026, 0, 15, 12, 0, 0)
const at = (day: number) => ({ startedAt: new Date(2026, 0, day, 9, 0, 0).getTime() })

describe('computeStreak', () => {
  it('is 0 with no sessions', () => {
    expect(computeStreak([], now)).toBe(0)
  })
  it('counts today', () => {
    expect(computeStreak([at(15)], now)).toBe(1)
  })
  it('counts consecutive days including today', () => {
    expect(computeStreak([at(15), at(14), at(13)], now)).toBe(3)
  })
  it('multiple sessions on one day count once', () => {
    expect(computeStreak([at(15), at(15), at(14)], now)).toBe(2)
  })
  it('a gap ends the streak', () => {
    expect(computeStreak([at(15), at(13)], now)).toBe(1)
  })
  it('still counts a streak ending yesterday when today has no session', () => {
    expect(computeStreak([at(14), at(13)], now)).toBe(2)
  })
  it('is 0 when the most recent session is older than yesterday', () => {
    expect(computeStreak([at(13)], now)).toBe(0)
  })
})
