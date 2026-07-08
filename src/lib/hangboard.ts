import type { Exercise, HangboardSet, LoggedHang, LoggedSet, TemplateExercise } from '@/types'

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

// v10 (F51) — a template's HangboardSet becomes a standard duration TemplateExercise
// row referencing the grip exercise. The protocol lives in the row params: hang
// duration, load (weightKg → the row's default load), edge depth, inter-set rest,
// and — for an Abrahang/repeater (legacy hangType) — the reps + intra-rest.
export function hangSetToTemplateExercise(hs: HangboardSet, order: number): TemplateExercise {
  const abrahang = hs.hangType === 'abrahang'
  return {
    exerciseId: hangExerciseId(hs.gripType),
    exerciseName: hs.gripType,
    order,
    defaultSets: hs.sets,
    defaultDuration: hs.durationSeconds,
    defaultWeight: hs.weightKg,
    defaultRestSeconds: hs.restSeconds,
    defaultEdgeDepthMm: hs.edgeDepthMm,
    defaultIntraRestSeconds: abrahang ? (hs.intraRestSeconds ?? 3) : undefined,
    defaultAbrahangReps: abrahang ? (hs.abrahangReps ?? 6) : undefined,
  }
}

// Import path (F51) — fold a pre-F51 backup template's hangboardSets into its
// exercises as grip rows, then drop the array. Idempotent (no-op when absent), so
// post-F51 backups pass through unchanged. Mirrors the v10 upgrade.
export function foldTemplateHangboard<
  T extends { exercises?: TemplateExercise[]; hangboardSets?: HangboardSet[] },
>(t: T): T {
  const hs = t.hangboardSets
  if (!Array.isArray(hs) || hs.length === 0) return t
  const base = t.exercises?.length ?? 0
  const rows = hs.map((h, i) => hangSetToTemplateExercise(h, base + i))
  const next = { ...t, exercises: [...(t.exercises ?? []), ...rows] }
  delete next.hangboardSets
  return next
}

// v11 (F51) — a logged hang becomes a logged (duration) set for the grip exercise.
// The hang's load is bodyweight-relative, so it lands in additionalWeightKg (0 =
// plain bodyweight → undefined), keeping the "BW ±N kg" label and % consistent.
// Legacy LoggedHang never stored intra-rest, so only abrahangReps carries over.
export function hangToLoggedSet(h: LoggedHang): LoggedSet {
  const abrahang = h.hangType === 'abrahang'
  return {
    id: h.id,
    sessionId: h.sessionId,
    exerciseId: hangExerciseId(h.gripType),
    exerciseName: h.gripType,
    setNumber: h.setNumber,
    durationSeconds: h.actualDurationSeconds ?? h.targetDurationSeconds,
    additionalWeightKg: h.weightKg !== 0 ? h.weightKg : undefined,
    edgeDepthMm: h.edgeDepthMm,
    abrahangReps: abrahang ? h.abrahangReps : undefined,
    restTakenSeconds: h.restTakenSeconds,
    skipped: h.skipped,
    loggedAt: h.loggedAt,
  }
}
