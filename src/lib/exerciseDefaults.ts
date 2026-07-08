import type { Exercise, TemplateExercise } from '@/types'

// A98 — the hardcoded fallbacks used when an exercise carries no saved defaults.
// Distance rows default to a single set; everything else to three. Reps rows get
// 10 reps, holds 30s, and 90s rest, matching the long-standing add-to-template
// behaviour so existing exercises are unaffected.
const FALLBACK = {
  sets: 3,
  distanceSets: 1,
  reps: 10,
  durationSeconds: 30,
  restSeconds: 90,
} as const

export interface ResolvedExerciseDefaults {
  sets: number
  reps?: number
  durationSeconds?: number
  weightKg?: number
  distanceKm?: number
  restSeconds: number
  edgeDepthMm?: number
}

// Resolve an exercise's per-add default parameters (A98): its saved `defaults`
// where present, else the fallbacks, shaped by tracking type — reps rows carry
// reps/weight, holds carry a duration, distance rows carry a target distance.
export function resolveExerciseDefaults(ex: Exercise): ResolvedExerciseDefaults {
  const d = ex.defaults
  const timed = ex.trackingType === 'duration'
  const distance = ex.trackingType === 'distance'
  return {
    sets: d?.sets ?? (distance ? FALLBACK.distanceSets : FALLBACK.sets),
    reps: timed || distance ? undefined : (d?.reps ?? FALLBACK.reps),
    durationSeconds: timed ? (d?.durationSeconds ?? FALLBACK.durationSeconds) : undefined,
    weightKg: timed || distance ? undefined : d?.weightKg,
    distanceKm: distance ? d?.distanceKm : undefined,
    restSeconds: d?.restSeconds ?? FALLBACK.restSeconds,
    // F51 — hangboard grips carry an edge depth (holds only); no fallback, so a
    // plain duration exercise stays edge-less.
    edgeDepthMm: timed ? d?.edgeDepthMm : undefined,
  }
}

// A TemplateExercise seeded from a library exercise, applying its defaults (A98).
export function templateExerciseFromExercise(ex: Exercise, order: number): TemplateExercise {
  const r = resolveExerciseDefaults(ex)
  return {
    exerciseId: ex.id,
    exerciseName: ex.name,
    order,
    defaultSets: r.sets,
    defaultReps: r.reps,
    defaultDuration: r.durationSeconds,
    defaultWeight: r.weightKg,
    defaultDistanceKm: r.distanceKm,
    defaultRestSeconds: r.restSeconds,
    defaultEdgeDepthMm: r.edgeDepthMm, // F51 — pre-fills the hang row's edge
  }
}
