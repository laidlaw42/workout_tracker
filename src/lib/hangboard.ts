import { metricsToConfig } from '@/lib/metrics'
import type {
  Exercise,
  ExerciseDefaults,
  ExerciseMetric,
  HangboardSet,
  LoggedHang,
  LoggedSet,
  TemplateExercise,
} from '@/types'

// F51 — the science-backed starting protocol pre-filled when a grip is added to a
// workout: a sub-maximal repeater — 7s hold × 6 sets, 180s rest, on a 20mm edge.
// Matches the reference hangboard guidance (repeaters rest 180s; max hangs, which
// the user dials up per grip, rest ~300s); tuned per grip in the row.
export const HANG_GRIP_DEFAULTS: ExerciseDefaults = {
  sets: 6,
  durationSeconds: 7,
  restSeconds: 180,
  edgeDepthMm: 20,
}

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

// Whether an exercise id is a grip (hang) exercise. F51 replaced the template's
// hangboardSets with grip-exercise rows, so "does this workout contain hangs?" is
// now "does it reference a grip exercise?" — keyed off the stable ex_hang_ prefix.
export function isHangExerciseId(id: string | undefined): boolean {
  return !!id && id.startsWith('ex_hang_')
}

// A grip tracks sets of a timed hang on a measured edge, loaded relative to
// bodyweight (the Load metric → % = (BW+load)/BW, assisted allowed).
const HANG_METRICS: ExerciseMetric[] = ['sets', 'duration', 'rest', 'edge', 'load']

// Build the Exercise record for a grip, with the hang metrics + derived config.
export function hangGripExercise(grip: string, now: number): Exercise {
  return {
    id: hangExerciseId(grip),
    name: grip,
    category: 'hangboard',
    muscleGroups: ['forearms'],
    tags: [],
    notes: gripDescription(grip),
    metrics: HANG_METRICS,
    ...metricsToConfig(HANG_METRICS),
    defaults: { ...HANG_GRIP_DEFAULTS },
    createdAt: now,
  }
}

// A generic description for a grip exercise (its editor Description + backfill).
export function gripDescription(grip: string): string {
  return `${grip} — a hangboard grip position, trained with timed hangs on an edge.`
}

// v10 (F51) — a template's HangboardSet becomes a standard duration TemplateExercise
// row referencing the grip exercise. The protocol lives in the row params: hang
// duration, load (weightKg → the row's default load), edge depth, inter-set rest.
export function hangSetToTemplateExercise(hs: HangboardSet, order: number): TemplateExercise {
  return {
    exerciseId: hangExerciseId(hs.gripType),
    exerciseName: hs.gripType,
    order,
    defaultSets: hs.sets,
    defaultDuration: hs.durationSeconds,
    defaultWeight: hs.weightKg,
    defaultRestSeconds: hs.restSeconds,
    defaultEdgeDepthMm: hs.edgeDepthMm,
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
export function hangToLoggedSet(h: LoggedHang): LoggedSet {
  return {
    id: h.id,
    sessionId: h.sessionId,
    exerciseId: hangExerciseId(h.gripType),
    exerciseName: h.gripType,
    setNumber: h.setNumber,
    durationSeconds: h.actualDurationSeconds ?? h.targetDurationSeconds,
    additionalWeightKg: h.weightKg !== 0 ? h.weightKg : undefined,
    edgeDepthMm: h.edgeDepthMm,
    restTakenSeconds: h.restTakenSeconds,
    skipped: h.skipped,
    loggedAt: h.loggedAt,
  }
}
