import type { Exercise } from '@/types'

// F51 — grip-as-exercise. In the unified model a hangboard "exercise" is a grip
// position (Half crimp, Open hand, …); the protocol (hang duration, load, edge,
// sets, and — for Abrahang/repeaters — the reps + intra-rest) lives on the
// template row / logged set, not the exercise. Per-grip PRs therefore flow through
// the standard exerciseName-keyed PR path with no special-casing.

// Deterministic, stable id for a grip so the same grip always maps to one exercise
// (across the v10/v11 migrations, the seed, and live logging). Free-text grips are
// slugged; anything unslug­gable falls back so an id is always produced.
export function hangExerciseId(grip: string): string {
  const slug = grip
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `ex_hang_${slug || 'grip'}`
}

// Build the Exercise record for a grip. A hang is a duration movement loaded
// relative to bodyweight (isBodyweight → % = (BW+load)/BW, assisted allowed), on a
// measured edge, and able to run an intra-rest (Abrahang/repeater) protocol — a
// plain max/sub-max hang simply uses one rep with no intra-rest.
export function hangGripExercise(grip: string, now: number): Exercise {
  return {
    id: hangExerciseId(grip),
    name: grip,
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
    createdAt: now,
  }
}
