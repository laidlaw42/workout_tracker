import { describe, it, expect } from 'vitest'
import {
  hangExerciseId,
  hangGripExercise,
  hangSetToTemplateExercise,
  hangToLoggedSet,
} from './hangboard'
import type { HangboardSet, LoggedHang } from '@/types'

describe('hangExerciseId', () => {
  it('slugs a grip to a stable id', () => {
    expect(hangExerciseId('Half crimp')).toBe('ex_hang_half_crimp')
    expect(hangExerciseId('Three-finger drag')).toBe('ex_hang_three_finger_drag')
    expect(hangExerciseId('Front three')).toBe('ex_hang_front_three')
  })
  it('is stable across casing / spacing / punctuation', () => {
    expect(hangExerciseId('  HALF   CRIMP  ')).toBe('ex_hang_half_crimp')
    expect(hangExerciseId('Half-crimp')).toBe('ex_hang_half_crimp')
  })
  it('always produces an id, even for unsluggable input', () => {
    expect(hangExerciseId('!!!')).toBe('ex_hang_grip')
    expect(hangExerciseId('')).toBe('ex_hang_grip')
  })
})

describe('hangGripExercise', () => {
  it('builds a bodyweight-loaded, edged, intra-rest-capable duration exercise', () => {
    expect(hangGripExercise('Open hand', 123)).toEqual({
      id: 'ex_hang_open_hand',
      name: 'Open hand',
      category: 'hangboard',
      muscleGroups: ['forearms'],
      trackingType: 'duration',
      tags: [],
      hasWeight: true,
      weightLabel: 'load',
      isBodyweight: true,
      supportsNegativeLoad: true,
      hasIntraRest: true,
      hasEdgeDepth: true,
      defaults: { sets: 6, durationSeconds: 7, restSeconds: 180, edgeDepthMm: 20 },
      createdAt: 123,
    })
  })
})

const hangSet = (patch: Partial<HangboardSet>): HangboardSet => ({
  id: 'h1',
  gripType: 'Half crimp',
  hangType: 'sub_max',
  edgeDepthMm: 20,
  durationSeconds: 7,
  weightKg: 0,
  sets: 6,
  restSeconds: 180,
  order: 0,
  ...patch,
})

describe('hangSetToTemplateExercise', () => {
  it('maps a plain hang set to a duration row (no intra-rest)', () => {
    expect(hangSetToTemplateExercise(hangSet({ weightKg: 10 }), 2)).toEqual({
      exerciseId: 'ex_hang_half_crimp',
      exerciseName: 'Half crimp',
      order: 2,
      defaultSets: 6,
      defaultDuration: 7,
      defaultWeight: 10,
      defaultRestSeconds: 180,
      defaultEdgeDepthMm: 20,
      defaultIntraRestSeconds: undefined,
      defaultAbrahangReps: undefined,
    })
  })
  it('carries reps + intra-rest for an Abrahang protocol', () => {
    expect(
      hangSetToTemplateExercise(
        hangSet({ hangType: 'abrahang', abrahangReps: 6, intraRestSeconds: 3 }),
        0,
      ),
    ).toMatchObject({ defaultIntraRestSeconds: 3, defaultAbrahangReps: 6 })
  })
  it('defaults Abrahang reps/intra-rest when the legacy row omitted them', () => {
    expect(hangSetToTemplateExercise(hangSet({ hangType: 'abrahang' }), 0)).toMatchObject({
      defaultIntraRestSeconds: 3,
      defaultAbrahangReps: 6,
    })
  })
})

const loggedHang = (patch: Partial<LoggedHang>): LoggedHang => ({
  id: 'lh1',
  sessionId: 's1',
  gripType: 'Half crimp',
  edgeDepthMm: 20,
  setNumber: 1,
  targetDurationSeconds: 7,
  actualDurationSeconds: 7,
  weightKg: 0,
  skipped: false,
  loggedAt: 1000,
  ...patch,
})

describe('hangToLoggedSet', () => {
  it('maps a logged hang to a duration set; a bodyweight hang carries no load', () => {
    expect(hangToLoggedSet(loggedHang({}))).toEqual({
      id: 'lh1',
      sessionId: 's1',
      exerciseId: 'ex_hang_half_crimp',
      exerciseName: 'Half crimp',
      setNumber: 1,
      durationSeconds: 7,
      additionalWeightKg: undefined,
      edgeDepthMm: 20,
      abrahangReps: undefined,
      restTakenSeconds: undefined,
      skipped: false,
      loggedAt: 1000,
    })
  })
  it('added load → additionalWeightKg; assisted (negative) preserved', () => {
    expect(hangToLoggedSet(loggedHang({ weightKg: 12 }))).toMatchObject({ additionalWeightKg: 12 })
    expect(hangToLoggedSet(loggedHang({ weightKg: -8 }))).toMatchObject({ additionalWeightKg: -8 })
  })
  it('prefers the actual hang duration over the target', () => {
    expect(
      hangToLoggedSet(loggedHang({ targetDurationSeconds: 10, actualDurationSeconds: 8 })),
    ).toMatchObject({ durationSeconds: 8 })
  })
  it('carries Abrahang reps only for an Abrahang hang', () => {
    expect(
      hangToLoggedSet(loggedHang({ hangType: 'abrahang', abrahangReps: 6 })),
    ).toMatchObject({ abrahangReps: 6 })
    expect(hangToLoggedSet(loggedHang({ abrahangReps: 6 }))).toMatchObject({ abrahangReps: undefined })
  })
})
