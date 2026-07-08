import { db } from './db'
import { deriveExerciseParams } from '@/lib/migrations'
import { HANG_GRIP_DEFAULTS, gripDescription, hangExerciseId, hangGripExercise } from '@/lib/hangboard'
import { GRIP_TYPES } from '@/lib/climbing'
import type {
  Exercise,
  ExerciseCategory,
  HangboardSet,
  IntervalBlock,
  TemplateExercise,
  TrackingType,
  WorkoutTemplate,
} from '@/types'

// Built-in content uses STABLE ids (ex_*, tpl_*) so the library can grow over
// time: new built-ins are added on upgrade, user-deleted ones are not
// resurrected, and user-created templates (uuid ids) are never touched.

const BUILTIN_SET_VERSION = 11 // hangboard templates simplified to plain sustained holds

// Built-in strength templates removed in A54 — deleted once from existing
// libraries (keyed by the meta flag below) and absent from the seed arrays so
// they are never re-added.
const REMOVED_TEMPLATE_IDS = ['tpl_push_b', 'tpl_pull_b', 'tpl_legs_b', 'tpl_full_body_b']

// Built-in exercises removed/merged when the library was refocused toward climbing:
// off-target rehab (tibialis, Achilles eccentric, Copenhagen), bodybuilding filler
// (hip thrust, muscle-up), and duplicate forearm/shoulder entries collapsed into a
// single canonical exercise each. Deleted once from existing libraries (keyed by the
// meta flag below) and absent from EXERCISES so they are never re-seeded. The first
// group (through ex_shoulder_press_antagonist) was template-free; the isolation lifts
// below had their PPL/UL/full-body template rows re-pointed to compounds.
const REMOVED_EXERCISE_IDS = [
  'ex_hip_thrust',
  'ex_muscle_up',
  'ex_tibialis_raise',
  'ex_calf_eccentric',
  'ex_copenhagen_plank',
  'ex_reverse_wrist_curl', // merged → ex_reverse_wrist_curl_climbing
  'ex_wrist_roller', // merged → ex_wrist_roller_flexion / ex_wrist_roller_extension
  'ex_rice_bucket_grip', // merged → ex_rice_bucket
  'ex_theraband_external_rotation', // merged → ex_rotator_cuff_external_rotation
  'ex_banded_external_rotation', // merged → ex_rotator_cuff_external_rotation
  'ex_shoulder_press_antagonist', // merged → ex_db_shoulder_press
  // Bodybuilding-isolation lifts cut to refocus the library on climbing; the
  // PPL/UL/full-body templates were re-pointed to compound substitutes. Kept
  // ex_bench_press (keystone) and ex_hammer_curl (forearm/elbow value).
  'ex_cable_fly',
  'ex_lateral_raise',
  'ex_tricep_pushdown',
  'ex_tricep_overhead_extension',
  'ex_arnold_press',
  'ex_bicep_curl',
  'ex_kettlebell_swing',
  'ex_leg_press',
  'ex_leg_curl',
  'ex_glute_bridge',
  'ex_calf_raise',
  // F51 — the protocol-based hangboard exercises are superseded by grip-as-exercise
  // (Half crimp, Open hand, …); their protocol now lives on the template row.
  'ex_hb_max_hangs',
  'ex_hb_repeaters',
  'ex_hb_abrahangs',
  'ex_hb_min_edge',
]

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
  'ex_face_pull', // isolation, 15+ reps → 60s. Other members removed with the isolation-lift trim.
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
  // Seed-only intent: a bodyweight-plus-load movement (pull-up, dip, …). Never
  // stored on the record — seedToExercise derives the F51 config from it (F51).
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

// Build an Exercise record from a seed. Derives the six F51 tracking-config fields
// (deriveExerciseParams — the SAME logic the v9 upgrade and import path use) and
// drops the seed-only `supportsAdditionalWeight` intent so it never lands on a row.
function seedToExercise(e: ExerciseSeed, now: number): Exercise {
  const category = seedCategory(e)
  return {
    id: e.id,
    name: e.name,
    category,
    muscleGroups: e.muscleGroups,
    trackingType: e.trackingType,
    tags: [],
    notes: EXERCISE_DESCRIPTIONS[e.id],
    createdAt: now,
    hangboard: e.hangboard,
    ...deriveExerciseParams({ ...e, category }),
  }
}

const EXERCISES: ExerciseSeed[] = [
  // Lower body
  { id: 'ex_squat', name: 'Squat', muscleGroups: ['quads', 'glutes'], trackingType: 'reps' },
  { id: 'ex_front_squat', name: 'Front squat', muscleGroups: ['quads', 'core'], trackingType: 'reps' },
  { id: 'ex_deadlift', name: 'Deadlift', muscleGroups: ['hamstrings', 'back', 'glutes'], trackingType: 'reps' },
  { id: 'ex_romanian_deadlift', name: 'Romanian deadlift', muscleGroups: ['hamstrings', 'glutes'], trackingType: 'reps' },
  // Push
  { id: 'ex_bench_press', name: 'Bench press', muscleGroups: ['chest', 'triceps'], trackingType: 'reps' },
  { id: 'ex_incline_db_press', name: 'Incline dumbbell press', muscleGroups: ['chest', 'shoulders'], trackingType: 'reps' },
  { id: 'ex_chest_dip', name: 'Chest dip', muscleGroups: ['chest', 'triceps'], trackingType: 'reps', supportsAdditionalWeight: true },
  { id: 'ex_ring_dip', name: 'Ring dip', muscleGroups: ['chest', 'triceps'], trackingType: 'reps', supportsAdditionalWeight: true },
  { id: 'ex_overhead_press', name: 'Overhead press', muscleGroups: ['shoulders', 'triceps'], trackingType: 'reps' },
  { id: 'ex_db_shoulder_press', name: 'Dumbbell shoulder press', muscleGroups: ['shoulders', 'triceps'], trackingType: 'reps' },
  // Pull
  { id: 'ex_pull_up', name: 'Pull-up', muscleGroups: ['back', 'biceps'], trackingType: 'reps', supportsAdditionalWeight: true },
  { id: 'ex_chin_up', name: 'Chin-up', muscleGroups: ['back', 'biceps'], trackingType: 'reps', supportsAdditionalWeight: true },
  { id: 'ex_lat_pulldown', name: 'Lat pulldown', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { id: 'ex_seated_row', name: 'Seated row', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { id: 'ex_barbell_row', name: 'Barbell row', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { id: 'ex_face_pull', name: 'Face pull', muscleGroups: ['shoulders', 'back'], trackingType: 'reps' },
  // Core
  { id: 'ex_plank', name: 'Plank', muscleGroups: ['core'], trackingType: 'duration' },
  { id: 'ex_hanging_leg_raise', name: 'Hanging leg raise', muscleGroups: ['core'], trackingType: 'reps' },
  // Cardio
  { id: 'ex_run', name: 'Run', muscleGroups: [], trackingType: 'distance' },
  { id: 'ex_ride', name: 'Ride', muscleGroups: [], trackingType: 'distance' },
  { id: 'ex_row', name: 'Row', muscleGroups: [], trackingType: 'distance' },
  // Rehab / prehab (A42) — discipline-agnostic recovery work.
  { id: 'ex_rice_bucket', name: 'Rice bucket', muscleGroups: ['forearms'], trackingType: 'duration', category: 'rehab' },
  { id: 'ex_pronation_supination', name: 'Pronation/supination', muscleGroups: ['forearms'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_shoulder_cars', name: 'Shoulder CARs', muscleGroups: ['shoulders'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_hip_90_90', name: 'Hip 90/90', muscleGroups: ['hips'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_dead_hang', name: 'Dead hang (passive)', muscleGroups: ['forearms', 'shoulders'], trackingType: 'duration', category: 'rehab' },
  // Strength accessories added when the PPL/full-body templates were expanded (A54).
  { id: 'ex_single_arm_db_row', name: 'Single-arm dumbbell row', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { id: 'ex_cable_rear_delt_fly', name: 'Cable rear delt fly', muscleGroups: ['shoulders', 'back'], trackingType: 'reps' },
  { id: 'ex_hammer_curl', name: 'Hammer curl', muscleGroups: ['biceps', 'forearms'], trackingType: 'reps' },
  { id: 'ex_bulgarian_split_squat', name: 'Bulgarian split squat', muscleGroups: ['quads', 'glutes'], trackingType: 'reps' },
  { id: 'ex_walking_lunge', name: 'Walking lunge', muscleGroups: ['quads', 'glutes'], trackingType: 'reps' },
  { id: 'ex_db_row', name: 'Dumbbell row', muscleGroups: ['back', 'biceps'], trackingType: 'reps' },
  { id: 'ex_push_up', name: 'Push-up', muscleGroups: ['chest', 'triceps'], trackingType: 'reps' },
  // Additional rehab / prehab (A55). Exact duplicates of existing rows are
  // omitted (Reverse wrist curl, Shoulder CARs, Dead hang (passive)); the
  // distinctly-named variants below are seeded per F41's explicit list.
  { id: 'ex_banded_internal_rotation', name: 'Banded shoulder internal rotation', muscleGroups: ['shoulders'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_wrist_flexor_stretch', name: 'Wrist flexor stretch', muscleGroups: ['forearms'], trackingType: 'duration', category: 'rehab' },
  { id: 'ex_wrist_extensor_stretch', name: 'Wrist extensor stretch', muscleGroups: ['forearms'], trackingType: 'duration', category: 'rehab' },
  { id: 'ex_wrist_roller_flexion', name: 'Wrist roller (flexion)', muscleGroups: ['forearms'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_wrist_roller_extension', name: 'Wrist roller (extension)', muscleGroups: ['forearms'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_doorway_chest_stretch', name: 'Doorway chest stretch', muscleGroups: ['chest'], trackingType: 'duration', category: 'rehab' },
  { id: 'ex_thoracic_ext_foam_roller', name: 'Thoracic extension over foam roller', muscleGroups: ['back'], trackingType: 'duration', category: 'rehab' },
  { id: 'ex_scapular_wall_slide', name: 'Scapular wall slide', muscleGroups: ['shoulders', 'back'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_pallof_press', name: 'Pallof press', muscleGroups: ['core'], trackingType: 'reps', category: 'rehab' },
  { id: 'ex_single_leg_rdl_rehab', name: 'Single-leg Romanian deadlift (rehab weight)', muscleGroups: ['hamstrings', 'glutes'], trackingType: 'reps', category: 'rehab' },
  // Climbing-specific strength & conditioning (A56), sourced from Lattice Training
  // and climbing-conditioning literature. Isometric holds track duration; dynamic
  // movements track reps; external-loadable movements set supportsAdditionalWeight.
  { id: 'ex_campus_move', name: 'Campus board move', muscleGroups: ['forearms', 'back'], trackingType: 'reps', supportsAdditionalWeight: true, category: 'climbing' },
  { id: 'ex_system_board_move', name: 'System board move', muscleGroups: ['forearms', 'back'], trackingType: 'reps', category: 'climbing' },
  { id: 'ex_antagonist_press_flat', name: 'Antagonist press (flat)', muscleGroups: ['chest', 'triceps'], trackingType: 'reps', category: 'climbing' },
  { id: 'ex_antagonist_press_incline', name: 'Antagonist press (incline)', muscleGroups: ['chest', 'shoulders'], trackingType: 'reps', category: 'climbing' },
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
  // Finger-strength lifts (block/edge pulls & pinch) — loadable, lower-injury finger
  // training than bodyweight hangs; plus the one-arm pulling ladder and hanging core
  // that the library was missing. Edge/pinch lifts are loaded isometrics tracked as
  // reps (each rep a short max-load pull) with added weight.
  { id: 'ex_edge_lift', name: 'Edge lift (block pull)', muscleGroups: ['forearms'], trackingType: 'reps', supportsAdditionalWeight: true, category: 'climbing' },
  { id: 'ex_one_arm_edge_lift', name: 'One-arm edge lift', muscleGroups: ['forearms'], trackingType: 'reps', supportsAdditionalWeight: true, category: 'climbing' },
  { id: 'ex_pinch_block', name: 'Pinch block lift', muscleGroups: ['forearms'], trackingType: 'reps', supportsAdditionalWeight: true, category: 'climbing' },
  { id: 'ex_offset_pull_up', name: 'Offset pull-up', muscleGroups: ['back', 'biceps'], trackingType: 'reps', supportsAdditionalWeight: true, category: 'climbing' },
  { id: 'ex_frenchies', name: 'Frenchies (lock-off ladder)', muscleGroups: ['back', 'biceps'], trackingType: 'reps', category: 'climbing' },
  { id: 'ex_toes_to_bar', name: 'Toes-to-bar', muscleGroups: ['core'], trackingType: 'reps', category: 'climbing' },
  { id: 'ex_windshield_wiper', name: 'Windshield wipers', muscleGroups: ['core'], trackingType: 'reps', category: 'climbing' },
  // Hangboard grip exercises (F51 — grip-as-exercise) are not listed here: they are
  // built from GRIP_TYPES via hangGripExercise and seeded separately, since their
  // config (load, edge) is explicit rather than derived.
]

// One-line description (the exercise's `notes`) for each built-in exercise. Shown in
// the editor's Description field and backfilled onto existing libraries. Grip
// exercises get a generic description from hangGripExercise instead.
const EXERCISE_DESCRIPTIONS: Record<string, string> = {
  // Lower body
  ex_squat: 'Barbell back squat — the foundational lower-body strength lift.',
  ex_front_squat: 'Barbell on the front rack; more upright and quad/core-dominant than the back squat.',
  ex_deadlift: 'Hinge and pull a loaded barbell from the floor — full posterior-chain strength.',
  ex_romanian_deadlift: 'Stiff-legged hip hinge lowering the bar to mid-shin; hamstrings and glutes.',
  // Push
  ex_bench_press: 'Barbell press from the chest on a bench — the primary horizontal push.',
  ex_incline_db_press: 'Dumbbell press on an incline, emphasising the upper chest and shoulders.',
  ex_chest_dip: 'Press between parallel bars with a forward lean for chest emphasis; add load to progress.',
  ex_ring_dip: 'Dip on gymnastic rings — the instability adds a strong stabiliser demand.',
  ex_overhead_press: 'Standing barbell press from the shoulders to overhead.',
  ex_db_shoulder_press: 'Dumbbell press overhead; independent arms even out imbalances.',
  // Pull
  ex_pull_up: 'Overhand-grip pull to chin over the bar. Add weight or use assistance to scale.',
  ex_chin_up: 'Underhand-grip pull-up with more biceps involvement.',
  ex_lat_pulldown: 'Cable pulldown to the chest — a scalable vertical pull.',
  ex_seated_row: 'Cable row to the torso, driving the elbows back for mid-back thickness.',
  ex_barbell_row: 'Bent-over barbell row — a heavy horizontal pull for the back.',
  ex_face_pull: 'Cable pull to the face with high elbows; rear delts and shoulder health.',
  // Core
  ex_plank: 'Hold a rigid straight-body position on the forearms — timed anti-extension core.',
  ex_hanging_leg_raise: 'Hang from a bar and raise the legs to hip height or higher.',
  // Cardio
  ex_run: 'Running — logged by distance and time.',
  ex_ride: 'Cycling — logged by distance and time.',
  ex_row: 'Rowing (erg or water) — logged by distance and time.',
  // Rehab / prehab
  ex_rice_bucket: 'Dig, squeeze and rotate the hands in a rice bucket for forearm and finger recovery.',
  ex_pronation_supination: 'Rotate the forearm palm-up to palm-down, often with a light hammer.',
  ex_shoulder_cars: 'Controlled articular rotations — take the shoulder slowly through its full range.',
  ex_hip_90_90: 'Seated 90/90 hip position, rotating between sides to open the hips.',
  ex_dead_hang: 'Passive hang from a bar to decompress the shoulders and build grip endurance.',
  // Strength accessories
  ex_single_arm_db_row: 'One-arm dumbbell row braced on a bench; works each side independently.',
  ex_cable_rear_delt_fly: 'Cable reverse fly targeting the rear delts.',
  ex_hammer_curl: 'Neutral-grip curl hitting the biceps and forearm (brachioradialis).',
  ex_bulgarian_split_squat: 'Rear-foot-elevated split squat — single-leg quad and glute strength.',
  ex_walking_lunge: 'Step forward into alternating lunges for unilateral leg volume.',
  ex_db_row: 'Bent-over dumbbell row for the back.',
  ex_push_up: 'Bodyweight horizontal push; scalable chest and triceps work.',
  // Additional rehab / prehab
  ex_banded_internal_rotation: 'Band internal rotation of the shoulder for rotator-cuff balance.',
  ex_wrist_flexor_stretch: 'Extend the wrist and fingers to stretch the underside of the forearm.',
  ex_wrist_extensor_stretch: 'Flex the wrist to stretch the top of the forearm.',
  ex_wrist_roller_flexion: 'Roll a weighted cord up with a palms-up wrist action.',
  ex_wrist_roller_extension: 'Roll a weighted cord up with a palms-down wrist action.',
  ex_doorway_chest_stretch: 'Forearm on a doorframe, step through to stretch the chest and front shoulder.',
  ex_thoracic_ext_foam_roller: 'Extend the upper back over a foam roller to mobilise the thoracic spine.',
  ex_scapular_wall_slide: 'Slide the arms up a wall keeping contact — trains scapular upward rotation.',
  ex_pallof_press: 'Press a band or cable straight out and resist rotation — anti-rotation core.',
  ex_single_leg_rdl_rehab: 'Light single-leg Romanian deadlift for balance and hamstring control.',
  // Climbing-specific strength & conditioning
  ex_campus_move: 'Explosive up-and-down moves on campus rungs — advanced contact strength.',
  ex_system_board_move: 'Repeatable moves on a symmetric system/training board.',
  ex_antagonist_press_flat: 'Flat pressing to balance the pulling-heavy climbing load.',
  ex_antagonist_press_incline: 'Incline pressing for the shoulders as antagonist work.',
  ex_wrist_curl: 'Palms-up wrist curl for the finger flexors and forearm.',
  ex_reverse_wrist_curl_climbing: 'Palms-down wrist curl for the extensors — elbow-health balance.',
  ex_finger_extension_band: 'Open the fingers against a rubber band to balance the flexors.',
  ex_rotator_cuff_external_rotation: 'External rotation with a band or dumbbell for cuff strength.',
  ex_scapular_pull_up: 'From a dead hang, pull the shoulder blades down without bending the elbows.',
  ex_hollow_body_hold: 'Hold a dished, tensioned body position — the base climbing core shape.',
  ex_front_lever_progression: 'Work toward a horizontal front lever with tucked/advanced progressions.',
  ex_back_lever_progression: 'Work toward a horizontal back lever with tucked/advanced progressions.',
  ex_l_sit: 'Support the body with the legs held out straight — compression and core.',
  ex_plank_reach: 'Plank while reaching one arm forward, adding an anti-rotation demand.',
  ex_single_arm_hang_assisted: 'One-arm hang with the other hand assisting — builds toward a full one-armer.',
  ex_two_arm_lock_off: 'Hold a bent-arm position on the bar; add or remove load to scale.',
  ex_one_arm_lock_off: 'Hold a one-arm bent-elbow position — advanced pulling strength.',
  ex_typewriter_pull_up: 'Pull up, then shift side to side along the bar.',
  ex_archer_pull_up: 'Pull toward one hand while the other arm stays straight.',
  ex_edge_lift: 'Lift a loaded block/edge with a static grip — low-injury finger strength.',
  ex_one_arm_edge_lift: 'Single-hand edge/block lift for maximal finger strength.',
  ex_pinch_block: 'Lift a loaded pinch block to train thumb and pinch strength.',
  ex_offset_pull_up: 'Pull-up with the hands at different heights, biasing one arm.',
  ex_frenchies: 'Pull-up ladder pausing at lock-off positions each rep.',
  ex_toes_to_bar: 'Hang and bring the toes up to the bar — dynamic core and grip.',
  ex_windshield_wiper: 'Legs raised, rotate side to side like a wiper — rotational core.',
}

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
      { ex: 'ex_db_shoulder_press', sets: 3, reps: 10 }, // 90 — deltoid volume (was lateral raise + Arnold press)
      { ex: 'ex_chest_dip', sets: 3, reps: 10 }, // 90
      { ex: 'ex_push_up', sets: 3, reps: 15 }, // 90 — compound finisher (was tricep/fly isolation)
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
      { ex: 'ex_single_arm_db_row', sets: 3, reps: 10 }, // 90 (A54)
      { ex: 'ex_cable_rear_delt_fly', sets: 3, reps: 15, rest: 60 }, // A54
      { ex: 'ex_hammer_curl', sets: 3, reps: 12, rest: 60 }, // A54 — kept: forearm/elbow value (bicep curl dropped)
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
      { ex: 'ex_front_squat', sets: 3, reps: 8 }, // 90 — quad compound (was leg press)
      { ex: 'ex_bulgarian_split_squat', sets: 3, reps: 10, rest: 120 }, // A54
      { ex: 'ex_walking_lunge', sets: 3, reps: 12 }, // 90 (A54)
      { ex: 'ex_single_leg_rdl_rehab', sets: 3, reps: 10 }, // 90 — unilateral posterior (was leg curl; calf/glute-bridge dropped)
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
      { ex: 'ex_chest_dip', sets: 3, reps: 10 }, // 90 — push/antagonist (was lateral raise/isolation)
      { ex: 'ex_face_pull', sets: 3, reps: 15 }, // 60 — rear delt / shoulder health (was arm isolation)
    ],
  },
  {
    id: 'tpl_lower_a',
    name: 'Lower A',
    tags: ['lower'],
    rows: [
      { ex: 'ex_squat', sets: 4, reps: 6 }, // 180
      { ex: 'ex_romanian_deadlift', sets: 3, reps: 8 }, // 90
      { ex: 'ex_bulgarian_split_squat', sets: 3, reps: 10 }, // 90 — unilateral quad/glute (was leg press)
      { ex: 'ex_walking_lunge', sets: 3, reps: 12 }, // 90 — unilateral leg volume (was leg curl)
      { ex: 'ex_hanging_leg_raise', sets: 3, reps: 12 }, // 90 — core (was calf raise)
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
      { ex: 'ex_hanging_leg_raise', sets: 3, reps: 12 }, // 90 — core (was kettlebell swing)
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
    // Repeaters — sub-maximal sustained hangs across three grips: 6 sets of a 7s
    // hang on a 20mm edge, 180s between sets (finger-endurance work).
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
    // Max hangs — near-max recruitment: 5 sets of a 10s hang on a 20mm edge, 300s
    // (5 min) between sets to recover fully before reloading.
    id: 'tpl_hangboard_maxhangs',
    name: 'Max hangs',
    tags: ['hangboard', 'strength'],
    hangs: [
      { grip: 'Half crimp', edgeMm: 20, durationSeconds: 10, weightKg: 0, sets: 5, restSeconds: HANGBOARD_MAX_REST },
      { grip: 'Open hand', edgeMm: 20, durationSeconds: 10, weightKg: 0, sets: 5, restSeconds: HANGBOARD_MAX_REST },
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
      { grip: 'Open hand', edgeMm: 20, durationSeconds: 10, weightKg: 0, sets: 3, restSeconds: 120 },
      // Max-hang block — half crimp on a smaller edge.
      { grip: 'Half crimp', edgeMm: 10, durationSeconds: 7, weightKg: 0, sets: 3, restSeconds: HANGBOARD_MAX_REST },
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

// F51 — a seed hang row → a standard duration TemplateExercise referencing the grip
// exercise (a timed hang on a measured edge; the load default stays bodyweight).
function buildHangRow(
  grip: string,
  p: {
    edgeMm: number
    durationSeconds: number
    weightKg: number
    sets: number
    restSeconds: number
  },
  order: number,
): TemplateExercise {
  return {
    exerciseId: hangExerciseId(grip),
    exerciseName: grip,
    order,
    defaultSets: p.sets,
    defaultDuration: p.durationSeconds,
    defaultWeight: p.weightKg,
    defaultRestSeconds: p.restSeconds,
    defaultEdgeDepthMm: p.edgeMm,
  }
}

// F51 — every grip a built-in touches, plus the standard picker grips (GRIP_TYPES),
// seeded as grip exercises so template rows resolve and the picker is populated.
const SEED_GRIPS = [
  ...new Set<string>([
    ...GRIP_TYPES,
    ...HANGBOARD.flatMap((t) => t.hangs.map((h) => h.grip)),
    ...CLIMBING_WORKOUTS.flatMap((t) => t.hangs.map((h) => h.grip)),
  ]),
]

function buildTemplate(
  seed: StrengthSeed | CardioSeed | HangboardSeed | ClimbingWorkoutSeed,
  now: number,
): WorkoutTemplate {
  // Checked first: a climbing workout also has `hangs`, so it must be
  // distinguished before the hangboard branch.
  if ('climbingWorkout' in seed) {
    const rows = seed.rows.map<TemplateExercise>((r, order) => buildTemplateExercise(r, order))
    const hangRows = seed.hangs.map((h, i) => buildHangRow(h.grip, h, rows.length + i))
    return {
      id: seed.id,
      name: seed.name,
      // A94: a climbing-strength workout (climbing-category exercises + hangs)
      // lives under the Climbing discipline (A92). F51: hangs are exercise rows.
      categories: ['climbing'],
      tags: seed.tags,
      createdAt: now,
      exercises: [...rows, ...hangRows],
    }
  }
  if ('hangs' in seed) {
    return {
      id: seed.id,
      name: seed.name,
      // A94: a pure-hangboard template lives under the Climbing discipline (A92);
      // deriveSessionType routes it to the training session screen. F51: each grip
      // is a standard duration exercise row.
      categories: ['climbing'],
      tags: seed.tags,
      createdAt: now,
      exercises: seed.hangs.map((h, i) => buildHangRow(h.grip, h, i)),
    }
  }
  if ('rows' in seed) {
    return {
      id: seed.id,
      name: seed.name,
      categories: ['strength'],
      tags: seed.tags,
      createdAt: now,
      exercises: seed.rows.map<TemplateExercise>((r, order) => buildTemplateExercise(r, order)),
    }
  }
  return {
    id: seed.id,
    name: seed.name,
    categories: ['cardio'],
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

    // One-time removal of exercises purged/merged when the library was refocused
    // toward climbing. Historical sessions keep their denormalized exercise names;
    // only the library/picker entries go away. The flag is versioned: bumping it
    // (V1 → V2 when the isolation-lift batch was added to REMOVED_EXERCISE_IDS)
    // re-runs the idempotent bulkDelete so users who already ran an earlier batch
    // still get the newly-removed ids cleaned up.
    if (!(await getMeta<boolean>('removedExercisesV3'))) {
      await db.exercises.bulkDelete(REMOVED_EXERCISE_IDS)
      await db.meta.put({ key: 'removedExercisesV3', value: true })
    }

    // Seed each built-in exercise once (tracked by id), so a user-deleted
    // exercise is never re-seeded and user edits are never clobbered. F51 grip
    // exercises are built directly (explicit config) alongside the derived seeds.
    const seededExIds = (await getMeta<string[]>('seededExerciseIds')) ?? []
    const seededEx = new Set(seededExIds)
    const gripExercises = SEED_GRIPS.map((g) => hangGripExercise(g, now))
    const unseededBuiltins = EXERCISES.filter((e) => !seededEx.has(e.id))
    const unseededGrips = gripExercises.filter((e) => !seededEx.has(e.id))
    if (unseededBuiltins.length || unseededGrips.length) {
      const haveEx = new Set((await db.exercises.toArray()).map((e) => e.id))
      const toInsert = [
        ...unseededBuiltins.filter((e) => !haveEx.has(e.id)).map((e) => seedToExercise(e, now)),
        ...unseededGrips.filter((e) => !haveEx.has(e.id)),
      ]
      if (toInsert.length) await db.exercises.bulkPut(toInsert)
      for (const e of [...unseededBuiltins, ...unseededGrips]) seededEx.add(e.id)
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

    // F51 — grip exercises predating this change were seeded/migrated without any
    // `defaults`, so adding one fresh fell back to the generic 30s/90s. Give every
    // hangboard grip that still has no defaults the science-backed hang protocol
    // (7s · 6 sets · 180s · 20mm edge); grips the user already tuned are untouched.
    if (!(await getMeta<boolean>('hangGripDefaultsBackfilled'))) {
      await db.exercises.toCollection().modify((e) => {
        if (e.category === 'hangboard' && !e.defaults) e.defaults = { ...HANG_GRIP_DEFAULTS }
      })
      await db.meta.put({ key: 'hangGripDefaultsBackfilled', value: true })
    }

    // Backfill the Description (notes) on built-in exercises that predate it — from
    // the seed descriptions, or a generic one for grips. User notes are untouched.
    if (!(await getMeta<boolean>('exerciseDescriptionsBackfilled'))) {
      await db.exercises.toCollection().modify((e) => {
        if (e.notes && e.notes.trim()) return
        const desc =
          EXERCISE_DESCRIPTIONS[e.id] ??
          (e.category === 'hangboard' ? gripDescription(e.name) : undefined)
        if (desc) e.notes = desc
      })
      await db.meta.put({ key: 'exerciseDescriptionsBackfilled', value: true })
    }

    // (The pre-F51 supportsAdditionalWeight backfill was retired: the v9 Dexie
    // upgrade derives the tracking-config fields for every existing exercise.)

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
    const exToAdd = [
      ...EXERCISES.filter((e) => !haveEx.has(e.id)).map((e) => seedToExercise(e, now)),
      ...SEED_GRIPS.map((g) => hangGripExercise(g, now)).filter((e) => !haveEx.has(e.id)),
    ]
    if (exToAdd.length) await db.exercises.bulkPut(exToAdd)

    const haveTpl = new Set((await db.templates.toArray()).map((t) => t.id))
    const tplToAdd = ALL_TEMPLATE_SEEDS.filter((s) => !haveTpl.has(s.id)).map((s) =>
      buildTemplate(s, now),
    )
    if (tplToAdd.length) await db.templates.bulkPut(tplToAdd)
  })
}
