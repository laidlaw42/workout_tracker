import { describe, it, expect } from 'vitest'
import {
  addDays,
  dayKey,
  formatRelativeDay,
  fromDateKey,
  hhmmToMinutes,
  isInMonth,
  minutesToHHMM,
  monthGrid,
  startOfWeek,
  toDateKey,
  weekDays,
  weekdayHeaders,
  weekdayShort,
} from './date'

describe('day keys', () => {
  it('dayKey is unpadded local Y-M-D', () => {
    expect(dayKey(new Date(2026, 6, 1, 23, 59))).toBe('2026-6-1') // July = month index 6
  })
  it('toDateKey/fromDateKey round-trip a zero-padded key', () => {
    expect(toDateKey(new Date(2026, 6, 1))).toBe('2026-07-01')
    const d = fromDateKey('2026-07-01')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 1])
  })
})

describe('startOfWeek', () => {
  it('lands on Monday when the week starts Monday', () => {
    // 2026-07-08 is a Wednesday.
    const s = startOfWeek(new Date(2026, 6, 8), 1)
    expect(s.getDay()).toBe(1) // Monday
    expect(toDateKey(s)).toBe('2026-07-06')
  })
  it('lands on Sunday when the week starts Sunday', () => {
    const s = startOfWeek(new Date(2026, 6, 8), 0)
    expect(s.getDay()).toBe(0) // Sunday
    expect(toDateKey(s)).toBe('2026-07-05')
  })
  it('a Monday maps to itself under Monday-start', () => {
    const mon = new Date(2026, 6, 6)
    expect(toDateKey(startOfWeek(mon, 1))).toBe('2026-07-06')
  })
})

describe('weekDays / weekdayShort / headers', () => {
  it('returns 7 consecutive keys beginning at the week start', () => {
    const days = weekDays(new Date(2026, 6, 8), 1)
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-07-06')
    expect(days[6]).toBe('2026-07-12')
  })
  it('weekdayShort is independent of week-start', () => {
    expect(weekdayShort('2026-07-06')).toBe('Mon')
    expect(weekdayShort('2026-07-12')).toBe('Sun')
  })
  it('headers reorder for a Sunday start', () => {
    expect(weekdayHeaders(1)[0]).toBe('Mon')
    expect(weekdayHeaders(0)[0]).toBe('Sun')
    expect(weekdayHeaders(0)).toHaveLength(7)
  })
})

describe('monthGrid', () => {
  it('is a whole number of weeks starting on the week-start weekday', () => {
    const grid = monthGrid(new Date(2026, 6, 15), 1) // July 2026
    expect(grid.length % 7).toBe(0)
    expect(weekdayShort(grid[0])).toBe('Mon')
    // every day of July is present
    for (let d = 1; d <= 31; d++) expect(grid).toContain(`2026-07-${String(d).padStart(2, '0')}`)
  })
  it('isInMonth flags the padding days from adjacent months', () => {
    const anchor = new Date(2026, 6, 1)
    expect(isInMonth('2026-07-01', anchor)).toBe(true)
    expect(isInMonth('2026-06-30', anchor)).toBe(false)
  })
})

describe('addDays', () => {
  it('crosses a month boundary correctly', () => {
    expect(toDateKey(addDays(new Date(2026, 6, 31), 1))).toBe('2026-08-01')
  })
})

describe('hhmm parsing', () => {
  it('parses valid times and rejects out-of-range/garbage', () => {
    expect(hhmmToMinutes('05:30')).toBe(330)
    expect(hhmmToMinutes('0:00')).toBe(0)
    expect(hhmmToMinutes('23:59')).toBe(1439)
    expect(hhmmToMinutes('24:00')).toBeUndefined()
    expect(hhmmToMinutes('12:60')).toBeUndefined() // invalid minutes, not 13:00
    expect(hhmmToMinutes('20:99')).toBeUndefined()
    expect(hhmmToMinutes('abc')).toBeUndefined()
    expect(hhmmToMinutes('')).toBeUndefined()
  })
  it('minutesToHHMM zero-pads', () => {
    expect(minutesToHHMM(330)).toBe('05:30')
    expect(minutesToHHMM(0)).toBe('00:00')
  })
})

describe('formatRelativeDay', () => {
  const now = new Date(2026, 6, 8, 10, 0) // Wed 8 Jul 2026
  it('names today / yesterday / N days ago', () => {
    expect(formatRelativeDay(new Date(2026, 6, 8, 6, 0).getTime(), now)).toBe('today')
    expect(formatRelativeDay(new Date(2026, 6, 7, 23, 0).getTime(), now)).toBe('yesterday')
    expect(formatRelativeDay(new Date(2026, 6, 5).getTime(), now)).toBe('3 days ago')
  })
})
