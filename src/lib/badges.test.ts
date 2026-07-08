import { describe, it, expect } from 'vitest'
import { badgeForSession, badgesForSession, deriveSessionKind, normalizeVenue } from './badges'
import type { ClimbingRoute, WorkoutSession } from '@/types'

const sess = (s: Partial<WorkoutSession>) => s as WorkoutSession
const route = (style: ClimbingRoute['style']) => ({ style }) as ClimbingRoute

describe('normalizeVenue', () => {
  it('maps legacy home → board and rejects unknowns', () => {
    expect(normalizeVenue('home')).toBe('board')
    expect(normalizeVenue('gym')).toBe('gym')
    expect(normalizeVenue('crag')).toBe('crag')
    expect(normalizeVenue('board')).toBe('board')
    expect(normalizeVenue(undefined)).toBeUndefined()
    expect(normalizeVenue('nonsense')).toBeUndefined()
  })
})

describe('deriveSessionKind', () => {
  it('cardio uses logged activity, then planned, then other', () => {
    expect(deriveSessionKind(sess({ type: 'cardio' }), { cardioActivity: 'run' })).toEqual({
      cardioActivity: 'run',
    })
    expect(deriveSessionKind(sess({ type: 'cardio', plannedActivity: 'ride' }), {})).toEqual({
      cardioActivity: 'ride',
    })
    expect(deriveSessionKind(sess({ type: 'cardio' }), {})).toEqual({ cardioActivity: 'other' })
  })

  it('climbing with routes reports the dominant style + all distinct styles', () => {
    const kind = deriveSessionKind(sess({ type: 'climbing' }), {
      routes: [route('lead'), route('lead'), route('bouldering')],
    })
    expect(kind.climbingStyle).toBe('lead')
    expect(new Set(kind.climbingStyles)).toEqual(new Set(['bouldering', 'lead']))
  })

  it('climbing without routes falls back to hang → workout', () => {
    expect(deriveSessionKind(sess({ type: 'climbing' }), { hasHang: true })).toEqual({
      climbingIsHangboard: true,
    })
    expect(deriveSessionKind(sess({ type: 'climbing' }), { hasSet: true })).toEqual({
      climbingIsWorkout: true,
    })
  })

  it('a mixed session with only hangs reads as hangboard (A73)', () => {
    expect(deriveSessionKind(sess({ type: 'mixed' }), { hasHang: true })).toEqual({
      climbingIsHangboard: true,
    })
    // hangs + sets stays generic (Mixed)
    expect(deriveSessionKind(sess({ type: 'mixed' }), { hasHang: true, hasSet: true })).toEqual({})
  })
})

describe('badgeForSession', () => {
  it('strength and mixed', () => {
    expect(badgeForSession(sess({ type: 'strength' })).label).toBe('Strength')
    expect(badgeForSession(sess({ type: 'mixed' })).label).toBe('Mixed')
    expect(badgeForSession(sess({ type: 'mixed' }), { climbingIsHangboard: true }).label).toBe(
      'Hangboard',
    )
  })

  it('cardio follows the activity', () => {
    expect(badgeForSession(sess({ type: 'cardio' }), { cardioActivity: 'run' }).label).toBe('Run')
  })

  it('climbing icon follows the subtype, colour follows the venue', () => {
    expect(badgeForSession(sess({ type: 'climbing' }), { climbingStyle: 'bouldering' }).label).toBe(
      'Bouldering',
    )
    expect(badgeForSession(sess({ type: 'climbing' }), { climbingIsWorkout: true }).label).toBe(
      'Workout',
    )
    // venue colour is applied (pink for gym)
    expect(
      badgeForSession(sess({ type: 'climbing', climbingVenue: 'gym' }), {
        climbingStyle: 'lead',
      }).classes,
    ).toMatch(/pink/)
  })

  it('climbing with nothing logged falls back to the venue, else generic', () => {
    expect(badgeForSession(sess({ type: 'climbing', climbingVenue: 'crag' }), {}).label).toBe('Crag')
    expect(badgeForSession(sess({ type: 'climbing' }), {}).label).toBe('Climbing')
  })
})

describe('badgesForSession', () => {
  it('returns one badge per distinct climb style', () => {
    const badges = badgesForSession(sess({ type: 'climbing', climbingVenue: 'gym' }), {
      climbingStyles: ['bouldering', 'lead'],
    })
    expect(badges.map((b) => b.label)).toEqual(['Bouldering', 'Lead'])
  })
  it('falls back to a single badge otherwise', () => {
    expect(badgesForSession(sess({ type: 'strength' })).map((b) => b.label)).toEqual(['Strength'])
  })
})
