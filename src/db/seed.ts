import { db } from './db'
import type {
  Exercise,
  ExerciseCategory,
  HangboardSet,
  HangType,
  IntervalBlock,
  TemplateExercise,
  TrackingType,
  WorkoutTemplate,
} from '@/types'

// Built-in content uses STABLE ids (ex_*, tpl_*) so the library can grow over
// time: new built-ins are added on upgrade, user-deleted ones are not
// resurrected, and user-created templates (uuid ids) are never touched.

const BUILTIN_SET_VERSION = 7 // A73: hangboard exercises + hangboard/workout templates re-typed as training

// Built-in strength templates removed in A54 — deleted once from existing
// libraries (keyed by the meta flag below) and absent from the seed arrays so
// they are never re-added.
const REMOVED_TEMPLATE_IDS = ['tpl_push_b', 'tpl_pull_b', 'tpl_legs_b', 'tpl_full_body_b']

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
  'ex_calf_raise', // isolation, 15+ reps (A54 — science-based 60s)
])

// Derived, science-based default rest for an exercise. A row may override it with
// an explicit `rest` (A54) when the protocol calls for a different value than the
// exercise's usual bucket — e.g. a heavy Deadlift triple wanting a full 300s.
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
  // Hangboard protocol config (A73): present on category 'hangboard' exercises;
  // adding one to a training session seeds a HangboardSet from it.
  hangboard?: Omit<HangboardSet, 'id' | 'order'>
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
  // Rehab / prehab (A42) — discipline-agnostic recovery work.
  { id: 'ex_theraband_external_rotation', name: 'Theraband external rotation', muscleGroups: ['shoulders'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_wrist_roller', name: 'Wrist roller', muscleGroups: ['forearms'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_rice_bucket', name: 'Rice bucket', muscleGroups: ['forearms'], trackingType: 'duration', category: 'rehab' },
  { id: 'ex_reverse_wrist_curl', name: 'Reverse wrist curl', muscleGroups: ['forearms'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_pronation_supination', name: 'Pronation/supination', muscleGroups: ['forearms'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_shoulder_cars', name: 'Shoulder CARs', muscleGroups: ['shoulders'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_hip_90_90', name: 'Hip 90/90', muscleGroups: ['hips'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_dead_hang', name: 'Dead hang (passive)', muscleGroups: ['forearms', 'shoulders'], trackingType: 'duration', category: 'rehab' },
  // Strength accessories added when the PPL/full-body templates were expanded (A54).
  { id: 'ex_arnold_press', name: 'Arnold press', muscleGroups: ['shoulders', 'triceps'], trackingType: 'reps' },
  { id: 'ex_tricep_overhead_extension', name: 'Tricep overhead extension', muscleGroups: ['triceps'], trackingType: 'reps' },
  { id: 'ex_single_arm_db_row', name: 'Single-arm dumbbell row', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { id: 'ex_cable_rear_delt_fly', name: 'Cable rear delt fly', muscleGroups: ['shoulders', 'back'], trackingType: 'reps' },
  { id: 'ex_hammer_curl', name: 'Hammer curl', muscleGroups: ['biceps', 'forearms'], trackingType: 'reps' },
  { id: 'ex_bulgarian_split_squat', name: 'Bulgarian split squat', muscleGroups: ['quads', 'glutes'], trackingType: 'reps' },
  { id: 'ex_walking_lunge', name: 'Walking lunge', muscleGroups: ['quads', 'glutes'], trackingType: 'reps' },
  { id: 'ex_glute_bridge', name: 'Glute bridge', muscleGroups: ['glutes'], trackingType: 'reps' },
  { id: 'ex_db_row', name: 'Dumbbell row', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { id: 'ex_push_up', name: 'Push-up', muscleGroups: ['chest', 'triceps'], trackingType: 'reps' },
  { id: 'ex_kettlebell_swing', name: 'Kettlebell swing', muscleGroups: ['glutes', 'hamstrings', 'back'], trackingType: 'reps' },
  // Additional rehab / prehab (A55). Exact duplicates of existing rows are
  // omitted (Reverse wrist curl, Shoulder CARs, Dead hang (passive)); the
  // distinctly-named variants below are seeded per F41's explicit list.
  { id: 'ex_banded_external_rotation', name: 'Banded shoulder external rotation', muscleGroups: ['shoulders'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_banded_internal_rotation', name: 'Banded shoulder internal rotation', muscleGroups: ['shoulders'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_rice_bucket_grip', name: 'Rice bucket (grip)', muscleGroups: ['forearms'], trackingType: 'duration', category: 'rehab' },
  { id: 'ex_wrist_flexor_stretch', name: 'Wrist flexor stretch', muscleGroups: ['forearms'], trackingType: 'duration', category: 'rehab' },
  { id: 'ex_wrist_extensor_stretch', name: 'Wrist extensor stretch', muscleGroups: ['forearms'], trackingType: 'duration', category: 'rehab' },
  { id: 'ex_wrist_roller_flexion', name: 'Wrist roller (flexion)', muscleGroups: ['forearms'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_wrist_roller_extension', name: 'Wrist roller (extension)', muscleGroups: ['forearms'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_doorway_chest_stretch', name: 'Doorway chest stretch', muscleGroups: ['chest'], trackingType: 'duration', category: 'rehab' },
  { id: 'ex_thoracic_ext_foam_roller', name: 'Thoracic extension over foam roller', muscleGroups: ['back'], trackingType: 'duration', category: 'rehab' },
  { id: 'ex_scapular_wall_slide', name: 'Scapular wall slide', muscleGroups: ['shoulders', 'back'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_pallof_press', name: 'Pallof press', muscleGroups: ['core'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_copenhagen_plank', name: 'Copenhagen plank', muscleGroups: ['core'], trackingType: 'duration', category: 'rehab' },
  { id: 'ex_single_leg_rdl_rehab', name: 'Single-leg Romanian deadlift (rehab weight)', muscleGroups: ['hamstrings', 'glutes'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_tibialis_raise', name: 'Tibialis raise', muscleGroups: ['calves'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_calf_eccentric', name: 'Calf eccentric (Alfredson protocol)', muscleGroups: ['calves'], trackingType: 'reps', category: 'rehab' },
  // Climbing-specific strength & conditioning (A56), sourced from Lattice Training
  // and climbing-conditioning literature. Isometric holds track duration; dynamic
  // movements track reps; external-loadable movements set supportsAdditionalWeight.
  { id: 'ex_campus_move', name: 'Campus board move', muscleGroups: ['forearms', 'back'], trackingType: 'reps', supportsAdditionalWeight: true, category: 'climbing' },
  { id: 'ex_system_board_move', name: 'System board move', muscleGroups: ['forearms', 'back'], trackingType: 'reps', category: 'climbing' },
  { id: 'ex_antagonist_press_flat', name: 'Antagonist press (flat)', muscleGroups: ['chest', 'triceps'], trackingType: 'reps', category: 'climbing' },
  { id: 'ex_antagonist_press_incline', name: 'Antagonist press (incline)', muscleGroups: ['chest', 'shoulders'], trackingType: 'reps', category: 'climbing' },
  { id: 'ex_shoulder_press_antagonist', name: 'Shoulder press (climbing antagonist)', muscleGroups: ['shoulders'], trackingType: 'reps', category: 'climbing' },
  { id: 'ex_wrist_curl', name: 'Wrist curl', muscleGroups: ['forearms'], trackingType: 'reps', category: 'climbing' },
  { id: 'ex_reverse_wrist_curl_climbing', name: 'Reverse wrist curl (climbing)', muscleGroups: ['forearms'], trackingType: 'reps', category: 'climbing' },
  { id: 'ex_finger_extension_band', name: 'Finger extension (rubber band)', muscleGroups: ['forearms'], trackingType: 'reps', category: 'climbing' },
  { id: 'ex_rotator_cuff_external_rotation', name: 'Rotator cuff external rotation', muscleGroups: ['shoulders'], trackingType: 'reps', category: 'climbing' },
  { id: 'ex_scapular_pull_up', name: 'Scapular pull-up', muscleGroups: ['back', 'shoulders'], trackingType: 'reps', supportsAdditionalWeight: true, category: 'climbing' },
  { id: 'ex_hollow_body_hold', name: 'Hollow body hold', muscleGroups: ['core'], trackingType: 'duration', category: 'climbing' },
  { id: 'ex_front_lever_progression', name: 'Front lever progression', muscleGroups: ['core', 'back'], trackingType: 'duration', category: 'climbing' },
  { id: 'ex_back_lever_progression', name: 'Back lever progression', muscleGroups: ['core', 'back'], trackingType: 'duration', category: 'climbing' },
  { id: 'ex_l_sit', name: 'L-sit', muscleGroups: ['core'], trackingType: 'duration', category: 'climbing' },
  { id: 'ex_plank_reach', name: 'Plank with reach', muscleGroups: ['core'], trackingType: 'duration', category: 'climbing' },
  { id: 'ex_single_arm_hang_assisted', name: 'Single-arm hang (assisted)', muscleGroups: ['forearms', 'back'], trackingType: 'duration', category: 'climbing' },
  { id: 'ex_two_arm_lock_off', name: 'Two-arm lock-off', muscleGroups: ['back', 'biceps'], trackingType: 'duration', supportsAdditionalWeight: true, category: 'climbing' },
  { id: 'ex_one_arm_lock_off', name: 'One-arm lock-off', muscleGroups: ['back', 'biceps'], trackingType: 'duration', supportsAdditionalWeight: true, category: 'climbing' },
  { id: 'ex_typewriter_pull_up', name: 'Typewriter pull-up', muscleGroups: ['back', 'biceps'], trackingType: 'reps', supportsAdditionalWeight: true, category: 'climbing' },
  { id: 'ex_archer_pull_up', name: 'Archer pull-up', muscleGroups: ['back', 'biceps'], trackingType: 'reps', supportsAdditionalWeight: true, category: 'climbing' },
  // Hangboard exercises (A73) — first-class training exercises. Each carries a
  // default protocol (science-based rest: 300s max hangs, 180s repeaters); adding
  // one to a training session seeds a HangboardSet the athlete can tune per set.
  { id: 'ex_hb_max_hangs', name: 'Max hangs', muscleGroups: ['forearms'], trackingType: 'duration', category: 'hangboard', hangboard: { gripType: 'Half crimp', hangType: 'max_hang', edgeDepthMm: 20, durationSeconds: 10, weightKg: 0, sets: 5, restSeconds: 300 } },
  { id: 'ex_hb_repeaters', name: 'Repeaters', muscleGroups: ['forearms'], trackingType: 'duration', category: 'hangboard', hangboard: { gripType: 'Half crimp', hangType: 'sub_max', edgeDepthMm: 20, durationSeconds: 7, weightKg: 0, sets: 6, restSeconds: 180 } },
  { id: 'ex_hb_abrahangs', name: 'Abrahangs', muscleGroups: ['forearms'], trackingType: 'duration', category: 'hangboard', hangboard: { gripType: 'Half crimp', hangType: 'abrahang', edgeDepthMm: 20, durationSeconds: 7, weightKg: 0, sets: 3, restSeconds: 180, abrahangReps: 6, intraRestSeconds: 3 } },
  { id: 'ex_hb_min_edge', name: 'Minimum-edge hang', muscleGroups: ['forearms'], trackingType: 'duration', category: 'hangboard', hangboard: { gripType: 'Half crimp', hangType: 'max_hang', edgeDepthMm: 8, durationSeconds: 10, weightKg: 0, sets: 5, restSeconds: 300 } },
]

const EXERCISE_NAME = new Map(EXERCISES.map((e) => [e.id, e.name]))

// A strength row. `rest` is optional: when omitted the science-based
// restForExercise() default applies; when present it overrides for that row
// (A54). Set `duration` (seconds) instead of `reps` for a timed exercise.
interface StrengthRow {
  ex: string
  sets: number
  reps?: number
  duration?: number
  rest?: number
}

interface StrengthSeed {
  id: string
  name: string
  tags: string[]
  rows: StrengthRow[]
}

// Push B / Pull B / Legs B / Full Body B were removed and the remaining four
// templates expanded (A54). Existing exercises keep their science-based rests
// (restForExercise); added exercises carry an explicit `rest` only where the
// protocol differs from that default.
const STRENGTH: StrengthSeed[] = [
  // Push / Pull / Legs — session A
  {
    id: 'tpl_push_a',
    name: 'Push A',
    tags: ['push', 'ppl'],
    rows: [
      { ex: 'ex_bench_press', sets: 4, reps: 6 }, // 180
      { ex: 'ex_overhead_press', sets: 3, reps: 8 }, // 90
      { ex: 'ex_incline_db_press', sets: 3, reps: 10 }, // 90
      { ex: 'ex_lateral_raise', sets: 4, reps: 15 }, // 60 — bumped 3→4 sets (A54)
      { ex: 'ex_chest_dip', sets: 3, reps: 10 }, // 90
      { ex: 'ex_tricep_pushdown', sets: 3, reps: 12 }, // 60
      { ex: 'ex_cable_fly', sets: 3, reps: 15, rest: 60 }, // A54
      { ex: 'ex_arnold_press', sets: 3, reps: 12 }, // 90 (A54)
      { ex: 'ex_tricep_overhead_extension', sets: 3, reps: 12 }, // 90 (A54)
    ],
  },
  {
    id: 'tpl_pull_a',
    name: 'Pull A',
    tags: ['pull', 'ppl'],
    rows: [
      { ex: 'ex_deadlift', sets: 3, reps: 5 }, // 180
      { ex: 'ex_pull_up', sets: 3, reps: 8 }, // 90
      { ex: 'ex_barbell_row', sets: 3, reps: 8 }, // 90
      { ex: 'ex_face_pull', sets: 3, reps: 15 }, // 60
      { ex: 'ex_bicep_curl', sets: 3, reps: 12 }, // 60
      { ex: 'ex_single_arm_db_row', sets: 3, reps: 10 }, // 90 (A54)
      { ex: 'ex_cable_rear_delt_fly', sets: 3, reps: 15, rest: 60 }, // A54
      { ex: 'ex_hammer_curl', sets: 3, reps: 12, rest: 60 }, // A54
      { ex: 'ex_chin_up', sets: 3, reps: 6, rest: 180 }, // A54
    ],
  },
  {
    id: 'tpl_legs_a',
    name: 'Legs A',
    tags: ['legs', 'ppl'],
    rows: [
      { ex: 'ex_squat', sets: 4, reps: 6 }, // 180
      { ex: 'ex_romanian_deadlift', sets: 3, reps: 8 }, // 90
      { ex: 'ex_leg_press', sets: 3, reps: 12 }, // 90
      { ex: 'ex_leg_curl', sets: 3, reps: 12 }, // 90
      { ex: 'ex_calf_raise', sets: 4, reps: 15 }, // 60 (isolation, A54)
      { ex: 'ex_bulgarian_split_squat', sets: 3, reps: 10, rest: 120 }, // A54
      { ex: 'ex_walking_lunge', sets: 3, reps: 12 }, // 90 (A54)
      { ex: 'ex_glute_bridge', sets: 3, reps: 15, rest: 60 }, // A54
    ],
  },
  // Upper / Lower
  {
    id: 'tpl_upper_a',
    name: 'Upper A',
    tags: ['upper'],
    rows: [
      { ex: 'ex_bench_press', sets: 4, reps: 6 }, // 180
      { ex: 'ex_barbell_row', sets: 4, reps: 6 }, // 180
      { ex: 'ex_overhead_press', sets: 3, reps: 8 }, // 90
      { ex: 'ex_lat_pulldown', sets: 3, reps: 10 }, // 90
      { ex: 'ex_lateral_raise', sets: 3, reps: 15 }, // 60
      { ex: 'ex_bicep_curl', sets: 3, reps: 12 }, // 60
      { ex: 'ex_tricep_pushdown', sets: 3, reps: 12 }, // 60
    ],
  },
  {
    id: 'tpl_lower_a',
    name: 'Lower A',
    tags: ['lower'],
    rows: [
      { ex: 'ex_squat', sets: 4, reps: 6 }, // 180
      { ex: 'ex_romanian_deadlift', sets: 3, reps: 8 }, // 90
      { ex: 'ex_leg_press', sets: 3, reps: 12 }, // 90
      { ex: 'ex_leg_curl', sets: 3, reps: 12 }, // 90
      { ex: 'ex_calf_raise', sets: 4, reps: 15 }, // 60 (isolation, A54)
      { ex: 'ex_plank', sets: 3, duration: 45 }, // 90
    ],
  },
  // Full body — beginner, compound-focused
  {
    id: 'tpl_full_body_a',
    name: 'Full Body A',
    tags: ['full body', 'beginner'],
    rows: [
      { ex: 'ex_squat', sets: 3, reps: 5 }, // 180
      { ex: 'ex_bench_press', sets: 3, reps: 5 }, // 180
      { ex: 'ex_barbell_row', sets: 3, reps: 5 }, // 180
      { ex: 'ex_deadlift', sets: 3, reps: 5, rest: 300 }, // A54
      { ex: 'ex_db_row', sets: 3, reps: 10 }, // 90 (A54)
      { ex: 'ex_push_up', sets: 3, reps: 15, rest: 60 }, // A54
      { ex: 'ex_kettlebell_swing', sets: 3, reps: 15 }, // 90 (A54)
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
  abrahangReps?: number
  intraRestSeconds?: number
}

interface HangboardSeed {
  id: string
  name: string
  tags: string[]
  hangType: HangType // A37 — applies to every hang in the template
  hangs: HangboardRow[]
}

const HANGBOARD: HangboardSeed[] = [
  {
    id: 'tpl_hangboard_repeaters',
    name: 'Repeaters',
    tags: ['hangboard', 'endurance'],
    hangType: 'sub_max',
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
    hangType: 'max_hang',
    hangs: [
      { grip: 'Half crimp', edgeMm: 20, durationSeconds: 10, weightKg: 0, sets: 5, restSeconds: HANGBOARD_MAX_REST },
      { grip: 'Open hand', edgeMm: 20, durationSeconds: 10, weightKg: 0, sets: 5, restSeconds: HANGBOARD_MAX_REST },
    ],
  },
  {
    // Abrahangs (A37) — 6×(7s work / 3s rest) repeaters, 180s between sets.
    id: 'tpl_hangboard_abrahangs',
    name: 'Abrahangs',
    tags: ['hangboard', 'endurance'],
    hangType: 'abrahang',
    hangs: [
      { grip: 'Half crimp', edgeMm: 20, durationSeconds: 7, weightKg: 0, sets: 3, restSeconds: HANGBOARD_REPEATER_REST, abrahangReps: 6, intraRestSeconds: 3 },
      { grip: 'Open hand', edgeMm: 20, durationSeconds: 7, weightKg: 0, sets: 3, restSeconds: HANGBOARD_REPEATER_REST, abrahangReps: 6, intraRestSeconds: 3 },
    ],
  },
  {
    // Sub-max Repeaters (A53) — a full sub-maximal repeater protocol across the
    // six common grip positions. Each grip runs the classic 7s-on / 3s-off
    // repeater popularised as sub-maximal finger endurance work by Eva
    // López-Rivera ("Effects of isometric training…", 2019) and the Anderson
    // brothers' "The Rock Climber's Training Manual". The 7-on/3-off × 6 rep
    // sequencing is driven by the app's abrahang runner (hangType 'abrahang');
    // 'sub_max' plays a single sustained hang and would not reproduce the
    // repeater cadence, so abrahang is the faithful model of a sub-max repeater.
    // restSeconds is the 180s inter-set rest; the data model has no separate
    // inter-exercise (grip-change) rest field, so the ~300s between grips is left
    // to the athlete.
    id: 'tpl_hangboard_submax_repeaters',
    name: 'Sub-max Repeaters',
    tags: ['hangboard', 'endurance'],
    hangType: 'abrahang',
    hangs: [
      { grip: 'Half crimp', edgeMm: 20, durationSeconds: 7, weightKg: 0, sets: 3, restSeconds: HANGBOARD_REPEATER_REST, abrahangReps: 6, intraRestSeconds: 3 },
      { grip: 'Open hand', edgeMm: 20, durationSeconds: 7, weightKg: 0, sets: 3, restSeconds: HANGBOARD_REPEATER_REST, abrahangReps: 6, intraRestSeconds: 3 },
      { grip: 'Three-finger drag', edgeMm: 20, durationSeconds: 7, weightKg: 0, sets: 3, restSeconds: HANGBOARD_REPEATER_REST, abrahangReps: 6, intraRestSeconds: 3 },
      { grip: 'Pinch', edgeMm: 20, durationSeconds: 7, weightKg: 0, sets: 3, restSeconds: HANGBOARD_REPEATER_REST, abrahangReps: 6, intraRestSeconds: 3 },
      { grip: 'Wide pinch', edgeMm: 20, durationSeconds: 7, weightKg: 0, sets: 3, restSeconds: HANGBOARD_REPEATER_REST, abrahangReps: 6, intraRestSeconds: 3 },
      { grip: 'Sloper', edgeMm: 20, durationSeconds: 7, weightKg: 0, sets: 3, restSeconds: HANGBOARD_REPEATER_REST, abrahangReps: 6, intraRestSeconds: 3 },
    ],
  },
]

// A57 — a climbing "workout" template that mixes strength exercises with
// hangboard sets in one session. Rendered by ClimbingSessionScreen as an
// Exercises section above the Hangboard section (the block ordering in the
// comments is the intended athlete flow; the screen groups all exercises then
// all hangs). Reuses StrengthRow for the exercise rows.
interface ClimbingWorkoutHang {
  grip: string
  hangType: HangType
  edgeMm: number
  durationSeconds: number
  weightKg: number
  sets: number
  restSeconds: number
}

interface ClimbingWorkoutSeed {
  id: string
  name: string
  tags: string[]
  climbingWorkout: true // discriminator (distinguishes from StrengthSeed's rows)
  rows: StrengthRow[]
  hangs: ClimbingWorkoutHang[]
}

const CLIMBING_WORKOUTS: ClimbingWorkoutSeed[] = [
  {
    id: 'tpl_climbing_strength_fingers',
    name: 'Strength and Fingers',
    tags: ['climbing', 'strength', 'hangboard'],
    climbingWorkout: true,
    // Athlete flow: warm-up hang block → strength block → max-hang block →
    // antagonist finish. Exercises (strength block + antagonist finish) render in
    // the Exercises section; the two hang blocks render in the Hangboard section.
    rows: [
      { ex: 'ex_scapular_pull_up', sets: 3, reps: 10, rest: 90 },
      { ex: 'ex_two_arm_lock_off', sets: 3, duration: 8, rest: 120 },
      { ex: 'ex_antagonist_press_flat', sets: 3, reps: 12, rest: 90 },
      { ex: 'ex_hollow_body_hold', sets: 3, duration: 30, rest: 60 },
      { ex: 'ex_reverse_wrist_curl_climbing', sets: 3, reps: 15, rest: 60 },
      { ex: 'ex_finger_extension_band', sets: 3, reps: 15, rest: 60 },
    ],
    hangs: [
      // Warm-up block — sub-max open hand.
      { grip: 'Open hand', hangType: 'sub_max', edgeMm: 20, durationSeconds: 10, weightKg: 0, sets: 3, restSeconds: 120 },
      // Max-hang block — half crimp on a smaller edge.
      { grip: 'Half crimp', hangType: 'max_hang', edgeMm: 10, durationSeconds: 7, weightKg: 0, sets: 3, restSeconds: HANGBOARD_MAX_REST },
    ],
  },
]

// A StrengthRow → TemplateExercise. `rest` overrides the science-based default;
// `duration` (seconds) marks a timed exercise (no reps). Shared by strength
// templates and the exercise block of a climbing workout (A57).
function buildTemplateExercise(r: StrengthRow, order: number): TemplateExercise {
  return {
    exerciseId: r.ex,
    exerciseName: EXERCISE_NAME.get(r.ex) ?? r.ex,
    order,
    defaultSets: r.sets,
    defaultReps: r.duration != null ? undefined : r.reps,
    defaultDuration: r.duration,
    defaultRestSeconds: r.rest ?? restForExercise(r.ex, r.reps ?? 0),
  }
}

function buildTemplate(
  seed: StrengthSeed | CardioSeed | HangboardSeed | ClimbingWorkoutSeed,
  now: number,
): WorkoutTemplate {
  // Checked first: a climbing workout also has `hangs`, so it must be
  // distinguished before the hangboard branch.
  if ('climbingWorkout' in seed) {
    return {
      id: seed.id,
      name: seed.name,
      // A73: hangboarding + climbing strength are training, not climbing. A
      // template mixing exercises and hangs is a 'mixed' training template.
      type: 'mixed',
      tags: seed.tags,
      createdAt: now,
      exercises: seed.rows.map<TemplateExercise>((r, order) => buildTemplateExercise(r, order)),
      hangboardSets: seed.hangs.map((h, order) => ({
        id: `${seed.id}_h${order}`, // stable across refreshes
        gripType: h.grip,
        hangType: h.hangType,
        edgeDepthMm: h.edgeMm,
        durationSeconds: h.durationSeconds,
        weightKg: h.weightKg,
        sets: h.sets,
        restSeconds: h.restSeconds,
        order,
      })),
    }
  }
  if ('hangs' in seed) {
    return {
      id: seed.id,
      name: seed.name,
      // A73: a pure-hangboard template is a training template. It has no exercise
      // rows, only hangboardSets, and is 'mixed' so it renders on the training
      // session screen alongside any other training content.
      type: 'mixed',
      tags: seed.tags,
      createdAt: now,
      exercises: [],
      hangboardSets: seed.hangs.map((h, order) => ({
        id: `${seed.id}_h${order}`, // stable across refreshes
        gripType: h.grip,
        hangType: seed.hangType,
        edgeDepthMm: h.edgeMm,
        durationSeconds: h.durationSeconds,
        weightKg: h.weightKg,
        sets: h.sets,
        restSeconds: h.restSeconds,
        abrahangReps: h.abrahangReps,
        intraRestSeconds: h.intraRestSeconds,
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
      exercises: seed.rows.map<TemplateExercise>((r, order) => buildTemplateExercise(r, order)),
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

const ALL_TEMPLATE_SEEDS: (StrengthSeed | CardioSeed | HangboardSeed | ClimbingWorkoutSeed)[] = [
  ...STRENGTH,
  ...CARDIO,
  ...HANGBOARD,
  ...CLIMBING_WORKOUTS,
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

    // One-time removal of the retired B-session strength templates (A54).
    if (!(await getMeta<boolean>('removedBTemplates'))) {
      await db.templates.bulkDelete(REMOVED_TEMPLATE_IDS)
      await db.meta.put({ key: 'removedBTemplates', value: true })
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
