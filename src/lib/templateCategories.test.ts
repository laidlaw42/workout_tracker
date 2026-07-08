import { describe, it, expect } from 'vitest'
import { deriveSessionType, templateCategories } from './templateCategories'
import type { WorkoutTemplate } from '@/types'

// Minimal template shapes — these helpers only read categories/type/hangboardSets/
// climbingKind, so the rest of WorkoutTemplate is irrelevant here.
const tpl = (t: Partial<WorkoutTemplate>) => t as WorkoutTemplate

describe('templateCategories', () => {
  it('prefers the stored categories array', () => {
    expect(templateCategories(tpl({ categories: ['strength', 'cardio'] }))).toEqual([
      'strength',
      'cardio',
    ])
  })
  it('falls back to the legacy single type when categories is missing/empty', () => {
    expect(templateCategories(tpl({ type: 'climbing' }))).toEqual(['climbing'])
    expect(templateCategories(tpl({ categories: [], type: 'cardio' }))).toEqual(['cardio'])
  })
  it('a legacy mixed/unknown type with hangboard sets reads as climbing (A92)', () => {
    expect(templateCategories(tpl({ type: 'mixed', hangboardSets: [{}] as never }))).toEqual([
      'climbing',
    ])
  })
  it('a legacy mixed/unknown type with no hangs falls back to strength', () => {
    expect(templateCategories(tpl({ type: 'mixed' }))).toEqual(['strength'])
    expect(templateCategories(tpl({}))).toEqual(['strength'])
  })
})

describe('deriveSessionType — which screen a template opens', () => {
  it('a climbing template saved from a climbing session opens the climbing screen', () => {
    expect(deriveSessionType(tpl({ categories: ['climbing'], climbingKind: 'workout' }))).toBe(
      'climbing',
    )
  })
  it('a climbing category without climbingKind is mixed (no route logging)', () => {
    expect(deriveSessionType(tpl({ categories: ['climbing'] }))).toBe('mixed')
  })
  it('single cardio → cardio, but cardio + hangs → mixed', () => {
    expect(deriveSessionType(tpl({ categories: ['cardio'] }))).toBe('cardio')
    expect(deriveSessionType(tpl({ categories: ['cardio'], hangboardSets: [{}] as never }))).toBe(
      'mixed',
    )
  })
  it('strength and/or rehab only (no hangs) → strength', () => {
    expect(deriveSessionType(tpl({ categories: ['strength'] }))).toBe('strength')
    expect(deriveSessionType(tpl({ categories: ['rehab'] }))).toBe('strength')
    expect(deriveSessionType(tpl({ categories: ['strength', 'rehab'] }))).toBe('strength')
  })
  it('anything with hangboard sets, or multiple disciplines, → mixed', () => {
    expect(deriveSessionType(tpl({ categories: ['strength'], hangboardSets: [{}] as never }))).toBe(
      'mixed',
    )
    expect(deriveSessionType(tpl({ categories: ['strength', 'cardio'] }))).toBe('mixed')
    expect(
      deriveSessionType(tpl({ categories: ['climbing', 'strength'], climbingKind: 'workout' })),
    ).toBe('mixed')
  })
  it('routes a legacy record with no categories via its type', () => {
    expect(deriveSessionType(tpl({ type: 'strength' }))).toBe('strength')
  })
})
