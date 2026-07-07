import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  formatElapsed,
  formatPace,
  workoutDurationSeconds,
} from './formatDuration'

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(45)).toBe('45s')
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(754)).toBe('12:34')
    expect(formatDuration(3600)).toBe('1h 0m')
    expect(formatDuration(5025)).toBe('1h 24m')
  })
  it('clamps negatives to 0', () => {
    expect(formatDuration(-5)).toBe('0s')
  })
})

describe('formatPace', () => {
  it('formats seconds/km as m:ss', () => {
    expect(formatPace(342)).toBe('5:42 /km')
  })
  it('rounds to whole seconds before splitting (no ":60")', () => {
    expect(formatPace(359.6)).toBe('6:00 /km')
  })
  it('returns a dash for non-positive or non-finite input', () => {
    expect(formatPace(0)).toBe('—')
    expect(formatPace(-1)).toBe('—')
    expect(formatPace(Infinity)).toBe('—')
  })
})

describe('formatElapsed', () => {
  it('is MM:SS below an hour and H:MM:SS at/above', () => {
    expect(formatElapsed(462)).toBe('07:42')
    expect(formatElapsed(5025)).toBe('1:23:45')
    expect(formatElapsed(0)).toBe('00:00')
  })
})

describe('workoutDurationSeconds', () => {
  it('is the wall-clock span minus paused time', () => {
    expect(workoutDurationSeconds({ startedAt: 1000, endedAt: 61000 })).toBe(60)
    expect(
      workoutDurationSeconds({ startedAt: 1000, endedAt: 61000, pausedDuration: 10000 }),
    ).toBe(50)
  })
  it('is 0 for an unfinished session', () => {
    expect(workoutDurationSeconds({ startedAt: 1000 })).toBe(0)
  })
  it('never goes negative', () => {
    expect(workoutDurationSeconds({ startedAt: 1000, endedAt: 500 })).toBe(0)
  })
})
