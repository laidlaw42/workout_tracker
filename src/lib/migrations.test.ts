import { describe, it, expect } from 'vitest'
import {
  categoryForTracking,
  deriveExerciseParams,
  legacyTemplateToCategories,
  normaliseBoardVenue,
} from './migrations'

describe('categoryForTracking', () => {
  it('distance is cardio, everything else strength', () => {
    expect(categoryForTracking('distance')).toBe('cardio')
    expect(categoryForTracking('reps')).toBe('strength')
    expect(categoryForTracking('duration')).toBe('strength')
    expect(categoryForTracking(undefined)).toBe('strength')
  })
})

describe('normaliseBoardVenue', () => {
  it('renames home → board and passes others through', () => {
    expect(normaliseBoardVenue('home')).toBe('board')
    expect(normaliseBoardVenue('gym')).toBe('gym')
    expect(normaliseBoardVenue('board')).toBe('board')
    expect(normaliseBoardVenue(undefined)).toBeUndefined()
  })
})

describe('legacyTemplateToCategories', () => {
  const exCat = new Map<string, string>([
    ['s1', 'strength'],
    ['r1', 'rehab'],
    ['c1', 'climbing'],
    ['hb', 'hangboard'],
    ['cardio1', 'cardio'],
  ])

  it('cardio type maps straight through', () => {
    expect(legacyTemplateToCategories({ type: 'cardio' }, exCat)).toEqual(['cardio'])
  })
  it('derives distinct categories from exercise content', () => {
    const cats = legacyTemplateToCategories(
      { type: 'strength', exercises: [{ exerciseId: 's1' }, { exerciseId: 'r1' }] },
      exCat,
    )
    expect(new Set(cats)).toEqual(new Set(['strength', 'rehab']))
  })
  it('treats hangboard exercises and hangboard sets as climbing (A92)', () => {
    expect(
      legacyTemplateToCategories({ type: 'strength', exercises: [{ exerciseId: 'hb' }] }, exCat),
    ).toEqual(['climbing'])
    expect(
      legacyTemplateToCategories({ type: 'strength', hangboardSets: [{}] }, exCat),
    ).toEqual(['climbing'])
  })
  it('falls back to the legacy type (or strength) with no classifiable content', () => {
    expect(legacyTemplateToCategories({ type: 'climbing' }, exCat)).toEqual(['climbing'])
    expect(legacyTemplateToCategories({ type: 'strength' }, exCat)).toEqual(['strength'])
    expect(legacyTemplateToCategories({}, exCat)).toEqual(['strength'])
    // unknown exercise ids contribute nothing → fall back
    expect(
      legacyTemplateToCategories({ type: 'strength', exercises: [{ exerciseId: 'zzz' }] }, exCat),
    ).toEqual(['strength'])
  })
})

describe('deriveExerciseParams (F51 v9)', () => {
  it('a plain barbell lift keeps its weight input (F51 spec would have stripped it)', () => {
    expect(deriveExerciseParams({ trackingType: 'reps', category: 'strength' })).toEqual({
      hasWeight: true,
      weightLabel: 'weight',
      isBodyweight: false,
      supportsNegativeLoad: false,
      hasEdgeDepth: false,
    })
  })
  it('a bodyweight-loadable move gets added_load + assisted (negative) load', () => {
    expect(
      deriveExerciseParams({
        trackingType: 'reps',
        category: 'strength',
        supportsAdditionalWeight: true,
      }),
    ).toEqual({
      hasWeight: true,
      weightLabel: 'added_load',
      isBodyweight: true,
      supportsNegativeLoad: true, // assisted pull-ups (A99) — NOT hangboard-only
      hasEdgeDepth: false,
    })
  })
  it('a rehab reps move tracks no weight', () => {
    expect(deriveExerciseParams({ trackingType: 'reps', category: 'rehab' })).toMatchObject({
      hasWeight: false,
      weightLabel: 'weight',
    })
  })
  it('a cardio distance move tracks no weight', () => {
    expect(deriveExerciseParams({ trackingType: 'distance', category: 'cardio' })).toMatchObject({
      hasWeight: false,
    })
  })
  it('a bodyweight hold (plank) has no weight; a loadable hold does', () => {
    expect(deriveExerciseParams({ trackingType: 'duration', category: 'strength' })).toMatchObject({
      hasWeight: false,
    })
    expect(
      deriveExerciseParams({
        trackingType: 'duration',
        category: 'climbing',
        supportsAdditionalWeight: true,
      }),
    ).toMatchObject({ hasWeight: true, weightLabel: 'added_load', isBodyweight: true })
  })
  it('a hangboard exercise gets load + edge depth + bodyweight %', () => {
    expect(
      deriveExerciseParams({ trackingType: 'duration', category: 'hangboard' }),
    ).toMatchObject({
      hasWeight: true,
      weightLabel: 'load',
      isBodyweight: true,
      supportsNegativeLoad: true,
      hasEdgeDepth: true,
    })
  })
})
