import { db } from './db'
import type {
  Exercise,
  IntervalBlock,
  TemplateExercise,
  TrackingType,
  WorkoutTemplate,
} from '@/types'

// Built-in content uses STABLE ids (ex_*, tpl_*) so the library can grow over
// time: new built-ins are added on upgrade, user-deleted ones are not
// resurrected, and user-created templates (uuid ids) are never touched.

const BUILTIN_SET_VERSION = 2

interface ExerciseSeed {
  id: string
  name: string
  muscleGroups: string[]
  trackingType: TrackingType
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
  { id: 'ex_chest_dip', name: 'Chest dip', muscleGroups: ['chest', 'triceps'], trackingType: 'reps' },
  { id: 'ex_overhead_press', name: 'Overhead press', muscleGroups: ['shoulders', 'triceps'], trackingType: 'reps' },
  { id: 'ex_db_shoulder_press', name: 'Dumbbell shoulder press', muscleGroups: ['shoulders', 'triceps'], trackingType: 'reps' },
  { id: 'ex_lateral_raise', name: 'Lateral raise', muscleGroups: ['shoulders'], trackingType: 'reps' },
  { id: 'ex_tricep_pushdown', name: 'Tricep pushdown', muscleGroups: ['triceps'], trackingType: 'reps' },
  // Pull
  { id: 'ex_pull_up', name: 'Pull-up', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
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

function buildTemplate(seed: StrengthSeed | CardioSeed, now: number): WorkoutTemplate {
  if ('rows' in seed) {
    return {
      id: seed.id,
      name: seed.name,
      type: 'strength',
      tags: seed.tags,
      createdAt: now,
      exercises: seed.rows.map<TemplateExercise>((row, order) => {
        const [exId, sets, reps, rest, duration] = row
        return {
          exerciseId: exId,
          exerciseName: EXERCISE_NAME.get(exId) ?? exId,
          order,
          defaultSets: sets,
          defaultReps: duration != null ? undefined : reps,
          defaultDuration: duration,
          defaultRestSeconds: rest,
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

const ALL_TEMPLATE_SEEDS: (StrengthSeed | CardioSeed)[] = [...STRENGTH, ...CARDIO]
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
        .map<Exercise>((e) => ({ ...e, createdAt: now }))
      if (toInsert.length) await db.exercises.bulkPut(toInsert)
      for (const e of unseededEx) seededEx.add(e.id)
      await db.meta.put({ key: 'seededExerciseIds', value: [...seededEx] })
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

    await db.meta.put({ key: 'builtinSetVersion', value: BUILTIN_SET_VERSION })
  })
}
