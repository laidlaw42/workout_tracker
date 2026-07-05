import { db } from './db'
import type {
  Exercise,
  ExerciseCategory,
  IntervalBlock,
  TemplateExercise,
  TrackingType,
  WorkoutTemplate,
} from '@/types'

// Built-in content uses STABLE ids (ex_*, tpl_*) so the library can grow over
// time: new built-ins are added on upgrade, user-deleted ones are not
// resurrected, and user-created templates (uuid ids) are never touched.

const BUILTIN_SET_VERSION = 4

// Evidence-based rest defaults. Heavy compound lifts at low reps need long rests
// for full neuromuscular recovery and to preserve subsequent-set volume; longer
// rests also favour hypertrophy over very short rests (Grgic et al. 2018,
// systematic review; Schoenfeld et al. 2016, JSCR — 3 min > 1 min for strength
// and volume). Accessory work ~90s; small-muscle isolation ~60s.
const COMPOUND_180 = new Set([
  'ex_squat',
  'ex_front_squat',
  'ex_deadlift',
  'ex_romanian_deadlift',
  'ex_bench_press',
  'ex_overhead_press',
  'ex_pull_up',
  'ex_barbell_row',
])
const ISOLATION_60 = new Set([
  'ex_lateral_raise',
  'ex_face_pull',
  'ex_tricep_pushdown',
  'ex_bicep_curl',
])

function restForExercise(exId: string, reps: number): number {
  if (COMPOUND_180.has(exId) && reps <= 6) return 180 // heavy compound, 4–6 reps
  if (ISOLATION_60.has(exId)) return 60 // isolation, 15+ reps
  return 90 // accessory, 8–12 reps
}

interface ExerciseSeed {
  id: string
  name: string
  muscleGroups: string[]
  trackingType: TrackingType
  supportsAdditionalWeight?: boolean
  // Explicit category (A36). Optional here — omit it and it's derived from
  // trackingType (distance → cardio, else strength). A42's rehab seeds set it.
  category?: ExerciseCategory
}

// Category for a seeded exercise: explicit if given, else derived (A36).
function seedCategory(e: ExerciseSeed): ExerciseCategory {
  return e.category ?? (e.trackingType === 'distance' ? 'cardio' : 'strength')
}

const EXERCISES: ExerciseSeed[] = [
  // Lower body
  { id: 'ex_squat', name: 'Squat', muscleGroups: ['quads', 'glutes'], trackingType: 'reps' },
  { id: 'ex_front_squat', name: 'Front squat', muscleGroups: ['quads', 'core'], trackingType: 'reps' },
  { id: 'ex_deadlift', name: 'Deadlift', muscleGroups: ['hamstrings', 'back', 'glutes'], trackingType: 'reps' },
  { id: 'ex_romanian_deadlift', name: 'Romanian deadlift', muscleGroups: ['hamstrings', 'glutes'], trackingType: 'reps' },
  { id: 'ex_leg_press', name: 'Leg press', muscleGroups: ['quads', 'glutes'], trackingType: 'reps' },
  { id: 'ex_leg_curl', name: 'Leg curl', muscleGroups: ['hamstrings'], trackingType: 'reps' },
  { id: 'ex_hip_thrust', name: 'Hip thrust', muscleGroups: ['glutes'], trackingType: 'reps' },
  { id: 'ex_calf_raise', name: 'Calf raise', muscleGroups: ['calves'], trackingType: 'reps' },
  // Push
  { id: 'ex_bench_press', name: 'Bench press', muscleGroups: ['chest', 'triceps'], trackingType: 'reps' },
  { id: 'ex_incline_db_press', name: 'Incline dumbbell press', muscleGroups: ['chest', 'shoulders'], trackingType: 'reps' },
  { id: 'ex_cable_fly', name: 'Cable fly', muscleGroups: ['chest'], trackingType: 'reps' },
  { id: 'ex_chest_dip', name: 'Chest dip', muscleGroups: ['chest', 'triceps'], trackingType: 'reps', supportsAdditionalWeight: true },
  { id: 'ex_ring_dip', name: 'Ring dip', muscleGroups: ['chest', 'triceps'], trackingType: 'reps', supportsAdditionalWeight: true },
  { id: 'ex_overhead_press', name: 'Overhead press', muscleGroups: ['shoulders', 'triceps'], trackingType: 'reps' },
  { id: 'ex_db_shoulder_press', name: 'Dumbbell shoulder press', muscleGroups: ['shoulders', 'triceps'], trackingType: 'reps' },
  { id: 'ex_lateral_raise', name: 'Lateral raise', muscleGroups: ['shoulders'], trackingType: 'reps' },
  { id: 'ex_tricep_pushdown', name: 'Tricep pushdown', muscleGroups: ['triceps'], trackingType: 'reps' },
  // Pull
  { id: 'ex_pull_up', name: 'Pull-up', muscleGroups: ['back', 'biceps'], trackingType: 'reps', supportsAdditionalWeight: true },
  { id: 'ex_chin_up', name: 'Chin-up', muscleGroups: ['back', 'biceps'], trackingType: 'reps', supportsAdditionalWeight: true },
  { id: 'ex_muscle_up', name: 'Muscle-up', muscleGroups: ['back', 'chest', 'triceps'], trackingType: 'reps', supportsAdditionalWeight: true },
  { id: 'ex_lat_pulldown', name: 'Lat pulldown', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { id: 'ex_seated_row', name: 'Seated row', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { id: 'ex_barbell_row', name: 'Barbell row', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { id: 'ex_face_pull', name: 'Face pull', muscleGroups: ['shoulders', 'back'], trackingType: 'reps' },
  { id: 'ex_bicep_curl', name: 'Bicep curl', muscleGroups: ['biceps'], trackingType: 'reps' },
  // Core
  { id: 'ex_plank', name: 'Plank', muscleGroups: ['core'], trackingType: 'duration' },
  { id: 'ex_hanging_leg_raise', name: 'Hanging leg raise', muscleGroups: ['core'], trackingType: 'reps' },
  // Cardio
  { id: 'ex_run', name: 'Run', muscleGroups: [], trackingType: 'distance' },
  { id: 'ex_ride', name: 'Ride', muscleGroups: [], trackingType: 'distance' },
  { id: 'ex_row', name: 'Row', muscleGroups: [], trackingType: 'distance' },
]

const EXERCISE_NAME = new Map(EXERCISES.map((e) => [e.id, e.name]))

// A strength row: [exerciseId, sets, reps, restSeconds] — or duration variant.
type Row = [string, number, number, number] | [string, number, number, number, number]

interface StrengthSeed {
  id: string
  name: string
  tags: string[]
  rows: Row[]
}

const STRENGTH: StrengthSeed[] = [
  // Push / Pull / Legs — session A
  {
    id: 'tpl_push_a',
    name: 'Push A',
    tags: ['push', 'ppl'],
    rows: [
      ['ex_bench_press', 4, 6, 150],
      ['ex_overhead_press', 3, 8, 120],
      ['ex_incline_db_press', 3, 10, 90],
      ['ex_lateral_raise', 3, 15, 60],
      ['ex_chest_dip', 3, 10, 90],
      ['ex_tricep_pushdown', 3, 12, 60],
    ],
  },
  {
    id: 'tpl_pull_a',
    name: 'Pull A',
    tags: ['pull', 'ppl'],
    rows: [
      ['ex_deadlift', 3, 5, 180],
      ['ex_pull_up', 3, 8, 120],
      ['ex_barbell_row', 3, 8, 120],
      ['ex_face_pull', 3, 15, 60],
      ['ex_bicep_curl', 3, 12, 60],
    ],
  },
  {
    id: 'tpl_legs_a',
    name: 'Legs A',
    tags: ['legs', 'ppl'],
    rows: [
      ['ex_squat', 4, 6, 180],
      ['ex_romanian_deadlift', 3, 8, 120],
      ['ex_leg_press', 3, 12, 90],
      ['ex_leg_curl', 3, 12, 60],
      ['ex_calf_raise', 4, 15, 45],
    ],
  },
  // Push / Pull / Legs — session B
  {
    id: 'tpl_push_b',
    name: 'Push B',
    tags: ['push', 'ppl'],
    rows: [
      ['ex_overhead_press', 4, 6, 150],
      ['ex_incline_db_press', 4, 8, 120],
      ['ex_db_shoulder_press', 3, 10, 90],
      ['ex_cable_fly', 3, 12, 60],
      ['ex_lateral_raise', 3, 15, 45],
      ['ex_tricep_pushdown', 3, 15, 60],
    ],
  },
  {
    id: 'tpl_pull_b',
    name: 'Pull B',
    tags: ['pull', 'ppl'],
    rows: [
      ['ex_barbell_row', 4, 6, 150],
      ['ex_lat_pulldown', 3, 10, 90],
      ['ex_seated_row', 3, 10, 90],
      ['ex_face_pull', 3, 15, 60],
      ['ex_bicep_curl', 3, 12, 60],
      ['ex_hanging_leg_raise', 3, 12, 60],
    ],
  },
  {
    id: 'tpl_legs_b',
    name: 'Legs B',
    tags: ['legs', 'ppl'],
    rows: [
      ['ex_front_squat', 4, 6, 180],
      ['ex_hip_thrust', 3, 8, 120],
      ['ex_leg_press', 3, 12, 90],
      ['ex_leg_curl', 3, 15, 60],
      ['ex_calf_raise', 4, 15, 45],
    ],
  },
  // Upper / Lower
  {
    id: 'tpl_upper_a',
    name: 'Upper A',
    tags: ['upper'],
    rows: [
      ['ex_bench_press', 4, 6, 150],
      ['ex_barbell_row', 4, 6, 150],
      ['ex_overhead_press', 3, 8, 120],
      ['ex_lat_pulldown', 3, 10, 90],
      ['ex_lateral_raise', 3, 15, 45],
      ['ex_bicep_curl', 3, 12, 60],
      ['ex_tricep_pushdown', 3, 12, 60],
    ],
  },
  {
    id: 'tpl_lower_a',
    name: 'Lower A',
    tags: ['lower'],
    rows: [
      ['ex_squat', 4, 6, 180],
      ['ex_romanian_deadlift', 3, 8, 120],
      ['ex_leg_press', 3, 12, 90],
      ['ex_leg_curl', 3, 12, 60],
      ['ex_calf_raise', 4, 15, 45],
      ['ex_plank', 3, 0, 60, 45],
    ],
  },
  // Full body — beginner, compound-focused
  {
    id: 'tpl_full_body_a',
    name: 'Full Body A',
    tags: ['full body', 'beginner'],
    rows: [
      ['ex_squat', 3, 5, 180],
      ['ex_bench_press', 3, 5, 180],
      ['ex_barbell_row', 3, 5, 150],
    ],
  },
  {
    id: 'tpl_full_body_b',
    name: 'Full Body B',
    tags: ['full body', 'beginner'],
    rows: [
      ['ex_squat', 3, 5, 180],
      ['ex_overhead_press', 3, 5, 150],
      ['ex_deadlift', 1, 5, 180],
    ],
  },
]

const INTERVAL_RIDE: IntervalBlock[] = [
  { repeat: 1, steps: [{ label: 'Warmup', durationSeconds: 300 }] },
  {
    repeat: 8,
    steps: [
      { label: 'Hard', durationSeconds: 120 },
      { label: 'Easy', durationSeconds: 60 },
    ],
  },
  { repeat: 1, steps: [{ label: 'Cooldown', durationSeconds: 300 }] },
]

const ROW_INTERVALS: IntervalBlock[] = [
  { repeat: 1, steps: [{ label: 'Warmup', durationSeconds: 180 }] },
  {
    repeat: 6,
    steps: [
      { label: 'Hard', durationSeconds: 90 },
      { label: 'Easy', durationSeconds: 120 },
    ],
  },
  { repeat: 1, steps: [{ label: 'Cooldown', durationSeconds: 180 }] },
]

interface CardioSeed {
  id: string
  name: string
  tags: string[]
  activity: 'run' | 'ride' | 'row'
  targetDurationSeconds?: number
  intervals?: IntervalBlock[]
}

const CARDIO: CardioSeed[] = [
  { id: 'tpl_easy_run', name: 'Easy run', tags: ['easy'], activity: 'run', targetDurationSeconds: 1800 },
  { id: 'tpl_tempo_run', name: 'Tempo run', tags: ['tempo'], activity: 'run', targetDurationSeconds: 2400 },
  { id: 'tpl_zone2_ride', name: 'Zone 2 ride', tags: ['endurance'], activity: 'ride', targetDurationSeconds: 2700 },
  { id: 'tpl_interval_ride', name: 'Interval ride', tags: ['intervals'], activity: 'ride', intervals: INTERVAL_RIDE },
  { id: 'tpl_row_intervals', name: 'Rowing intervals', tags: ['intervals'], activity: 'row', intervals: ROW_INTERVALS },
]

// Hangboard rest defaults follow finger-tendon recovery guidance from the
// Anderson brothers ("The Rock Climber's Training Manual") and Lattice Training:
// ~180s (3 min) between repeater sets, ~300s (5 min) between max-recruitment /
// max-weight hangs, and ~480s (8 min) when changing grip position, to let the
// finger pulleys and connective tissue recover fully before reloading.
const HANGBOARD_REPEATER_REST = 180
const HANGBOARD_MAX_REST = 300

interface HangboardRow {
  grip: string
  edgeMm: number
  durationSeconds: number
  weightKg: number
  sets: number
  restSeconds: number
}

interface HangboardSeed {
  id: string
  name: string
  tags: string[]
  hangs: HangboardRow[]
}

const HANGBOARD: HangboardSeed[] = [
  {
    id: 'tpl_hangboard_repeaters',
    name: 'Repeaters',
    tags: ['hangboard', 'endurance'],
    hangs: [
      { grip: 'Half crimp', edgeMm: 20, durationSeconds: 7, weightKg: 0, sets: 6, restSeconds: HANGBOARD_REPEATER_REST },
      { grip: 'Open hand', edgeMm: 20, durationSeconds: 7, weightKg: 0, sets: 6, restSeconds: HANGBOARD_REPEATER_REST },
      { grip: 'Front three', edgeMm: 20, durationSeconds: 7, weightKg: 0, sets: 6, restSeconds: HANGBOARD_REPEATER_REST },
    ],
  },
  {
    id: 'tpl_hangboard_maxhangs',
    name: 'Max hangs',
    tags: ['hangboard', 'strength'],
    hangs: [
      { grip: 'Half crimp', edgeMm: 20, durationSeconds: 10, weightKg: 0, sets: 5, restSeconds: HANGBOARD_MAX_REST },
      { grip: 'Open hand', edgeMm: 20, durationSeconds: 10, weightKg: 0, sets: 5, restSeconds: HANGBOARD_MAX_REST },
    ],
  },
]

function buildTemplate(
  seed: StrengthSeed | CardioSeed | HangboardSeed,
  now: number,
): WorkoutTemplate {
  if ('hangs' in seed) {
    return {
      id: seed.id,
      name: seed.name,
      type: 'climbing',
      tags: seed.tags,
      createdAt: now,
      exercises: [],
      climbingKind: 'hangboard',
      hangboardSets: seed.hangs.map((h, order) => ({
        id: `${seed.id}_h${order}`, // stable across refreshes
        gripType: h.grip,
        edgeDepthMm: h.edgeMm,
        durationSeconds: h.durationSeconds,
        weightKg: h.weightKg,
        sets: h.sets,
        restSeconds: h.restSeconds,
        order,
      })),
    }
  }
  if ('rows' in seed) {
    return {
      id: seed.id,
      name: seed.name,
      type: 'strength',
      tags: seed.tags,
      createdAt: now,
      exercises: seed.rows.map<TemplateExercise>((row, order) => {
        const [exId, sets, reps, , duration] = row
        return {
          exerciseId: exId,
          exerciseName: EXERCISE_NAME.get(exId) ?? exId,
          order,
          defaultSets: sets,
          defaultReps: duration != null ? undefined : reps,
          defaultDuration: duration,
          defaultRestSeconds: restForExercise(exId, reps),
        }
      }),
    }
  }
  return {
    id: seed.id,
    name: seed.name,
    type: 'cardio',
    tags: seed.tags,
    createdAt: now,
    exercises: [],
    cardioActivity: seed.activity,
    targetDurationSeconds: seed.targetDurationSeconds,
    intervals: seed.intervals,
  }
}

const ALL_TEMPLATE_SEEDS: (StrengthSeed | CardioSeed | HangboardSeed)[] = [
  ...STRENGTH,
  ...CARDIO,
  ...HANGBOARD,
]
const LEGACY_TEMPLATE_NAMES = new Set(['Push A', 'Pull A', 'Legs A', 'Easy run', 'Interval ride'])
const BUILTIN_EXERCISE_NAMES = new Set(EXERCISES.map((e) => e.name))

async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

// Ensures the built-in library is present and up to date. Idempotent, additive,
// and respectful of user deletions (tracked by seeded id).
export async function seedIfNeeded(): Promise<void> {
  await db.transaction('rw', db.exercises, db.templates, db.meta, async () => {
    const now = Date.now()

    // One-time cleanup of the legacy (uuid-id) starter set, replaced by stable ids.
    const legacyDone = await getMeta<boolean>('legacyMigrated')
    if (!legacyDone) {
      await db.templates
        .filter((t) => !t.id.startsWith('tpl_') && LEGACY_TEMPLATE_NAMES.has(t.name))
        .delete()
      await db.exercises
        .filter((e) => !e.id.startsWith('ex_') && BUILTIN_EXERCISE_NAMES.has(e.name))
        .delete()
      await db.meta.put({ key: 'legacyMigrated', value: true })
    }

    // Seed each built-in exercise once (tracked by id), so a user-deleted
    // exercise is never re-seeded and user edits are never clobbered.
    const seededExIds = (await getMeta<string[]>('seededExerciseIds')) ?? []
    const seededEx = new Set(seededExIds)
    const unseededEx = EXERCISES.filter((e) => !seededEx.has(e.id))
    if (unseededEx.length) {
      const haveEx = new Set((await db.exercises.toArray()).map((e) => e.id))
      const toInsert = unseededEx
        .filter((e) => !haveEx.has(e.id))
        .map<Exercise>((e) => ({ ...e, category: seedCategory(e), tags: [], createdAt: now }))
      if (toInsert.length) await db.exercises.bulkPut(toInsert)
      for (const e of unseededEx) seededEx.add(e.id)
      await db.meta.put({ key: 'seededExerciseIds', value: [...seededEx] })
    }

    // Backfill tags on exercises created before the tags field existed.
    if (!(await getMeta<boolean>('exerciseTagsBackfilled'))) {
      await db.exercises.toCollection().modify((e) => {
        const rec = e as { tags?: string[] }
        if (rec.tags === undefined) rec.tags = []
      })
      await db.meta.put({ key: 'exerciseTagsBackfilled', value: true })
    }

    // Backfill the bodyweight-loadable flag onto built-ins that were seeded
    // before the field existed (e.g. Pull-up, Chest dip).
    if (!(await getMeta<boolean>('additionalWeightBackfilled'))) {
      for (const e of EXERCISES) {
        if (e.supportsAdditionalWeight) {
          await db.exercises.update(e.id, { supportsAdditionalWeight: true })
        }
      }
      await db.meta.put({ key: 'additionalWeightBackfilled', value: true })
    }

    // Seed built-in templates once each (never resurrect user-deleted ones).
    const seededIds = (await getMeta<string[]>('seededTemplateIds')) ?? []
    const seededSet = new Set(seededIds)
    const toAdd = ALL_TEMPLATE_SEEDS.filter((s) => !seededSet.has(s.id))
    if (toAdd.length) {
      await db.templates.bulkPut(toAdd.map((s) => buildTemplate(s, now)))
      for (const s of toAdd) seededSet.add(s.id)
      await db.meta.put({ key: 'seededTemplateIds', value: [...seededSet] })
    }

    // Refresh existing built-in template definitions once per version bump (e.g.
    // updated rest times), preserving createdAt/lastUsedAt. User templates are
    // untouched; a built-in the user deleted is not resurrected.
    const refreshedVer = (await getMeta<number>('builtinRefreshVersion')) ?? 0
    if (refreshedVer < BUILTIN_SET_VERSION) {
      for (const seed of ALL_TEMPLATE_SEEDS) {
        const existing = await db.templates.get(seed.id)
        if (existing) {
          const fresh = buildTemplate(seed, existing.createdAt)
          await db.templates.put({ ...fresh, lastUsedAt: existing.lastUsedAt })
        }
      }
      await db.meta.put({ key: 'builtinRefreshVersion', value: BUILTIN_SET_VERSION })
    }

    await db.meta.put({ key: 'builtinSetVersion', value: BUILTIN_SET_VERSION })
  })
}

// Re-insert any built-in exercises/templates that are missing (e.g. the user
// deleted them). Records that still exist — even if the user edited them — are
// left untouched, and user-created records are never affected.
export async function restoreDefaults(): Promise<void> {
  await db.transaction('rw', db.exercises, db.templates, async () => {
    const now = Date.now()

    const haveEx = new Set((await db.exercises.toArray()).map((e) => e.id))
    const exToAdd = EXERCISES.filter((e) => !haveEx.has(e.id)).map<Exercise>((e) => ({
      ...e,
      category: seedCategory(e),
      tags: [],
      createdAt: now,
    }))
    if (exToAdd.length) await db.exercises.bulkPut(exToAdd)

    const haveTpl = new Set((await db.templates.toArray()).map((t) => t.id))
    const tplToAdd = ALL_TEMPLATE_SEEDS.filter((s) => !haveTpl.has(s.id)).map((s) =>
      buildTemplate(s, now),
    )
    if (tplToAdd.length) await db.templates.bulkPut(tplToAdd)
  })
}
