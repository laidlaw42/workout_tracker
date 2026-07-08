import { describe, it, expect } from 'vitest'
import { resolveExerciseDefaults, templateExerciseFromExercise } from './exerciseDefaults'
import type { Exercise, ExerciseDefaults, TrackingType } from '@/types'

function exercise(trackingType: TrackingType, defaults?: ExerciseDefaults): Exercise {
  return {
    id: 'e1',
    name: 'Squat',
    category: 'strength',
    muscleGroups: [],
    trackingType,
    tags: [],
    defaults,
    createdAt: 0,
  }
}

describe('resolveExerciseDefaults — fallbacks', () => {
  it('reps fall back to 3 × 10 · 90s with no weight', () => {
    expect(resolveExerciseDefaults(exercise('reps'))).toEqual({
      sets: 3,
      reps: 10,
      durationSeconds: undefined,
      weightKg: undefined,
      distanceKm: undefined,
      restSeconds: 90,
    })
  })
  it('duration falls back to 3 × 30s hold', () => {
    const r = resolveExerciseDefaults(exercise('duration'))
    expect(r.sets).toBe(3)
    expect(r.durationSeconds).toBe(30)
    expect(r.reps).toBeUndefined()
  })
  it('distance falls back to a single set', () => {
    const r = resolveExerciseDefaults(exercise('distance'))
    expect(r.sets).toBe(1)
    expect(r.reps).toBeUndefined()
    expect(r.durationSeconds).toBeUndefined()
  })
})

describe('resolveExerciseDefaults — saved values', () => {
  it('applies saved reps defaults', () => {
    const r = resolveExerciseDefaults(
      exercise('reps', { sets: 5, reps: 5, weightKg: 60, restSeconds: 200 }),
    )
    expect(r).toMatchObject({ sets: 5, reps: 5, weightKg: 60, restSeconds: 200 })
  })
  it('ignores fields irrelevant to the tracking type', () => {
    // A duration default carrying a stray reps value should not surface reps.
    const r = resolveExerciseDefaults(
      exercise('duration', { sets: 4, reps: 8, durationSeconds: 12, restSeconds: 120 }),
    )
    expect(r.durationSeconds).toBe(12)
    expect(r.reps).toBeUndefined()
  })
  it('carries a hangboard grip edge depth (holds only)', () => {
    const r = resolveExerciseDefaults(
      exercise('duration', { sets: 6, durationSeconds: 7, restSeconds: 180, edgeDepthMm: 20 }),
    )
    expect(r).toMatchObject({ sets: 6, durationSeconds: 7, restSeconds: 180, edgeDepthMm: 20 })
  })
  it('drops an edge depth on a non-duration exercise', () => {
    expect(resolveExerciseDefaults(exercise('reps', { edgeDepthMm: 20 })).edgeDepthMm).toBeUndefined()
  })
})

describe('templateExerciseFromExercise', () => {
  it('produces a TemplateExercise from the resolved defaults', () => {
    const t = templateExerciseFromExercise(
      exercise('reps', { sets: 5, reps: 5, weightKg: 60, restSeconds: 200 }),
      2,
    )
    expect(t).toEqual({
      exerciseId: 'e1',
      exerciseName: 'Squat',
      order: 2,
      defaultSets: 5,
      defaultReps: 5,
      defaultDuration: undefined,
      defaultWeight: 60,
      defaultDistanceKm: undefined,
      defaultRestSeconds: 200,
      defaultEdgeDepthMm: undefined,
    })
  })
  it('carries a hangboard grip edge depth onto the row', () => {
    const t = templateExerciseFromExercise(
      exercise('duration', { sets: 6, durationSeconds: 7, restSeconds: 180, edgeDepthMm: 20 }),
      0,
    )
    expect(t).toMatchObject({ defaultDuration: 7, defaultRestSeconds: 180, defaultEdgeDepthMm: 20 })
  })
})
