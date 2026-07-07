// ---------------------------------------------------------------------------
// Shared enums / unions
// ---------------------------------------------------------------------------

// 'mixed' (A66) — a build-from-scratch session that ended up spanning more than
// one discipline (e.g. strength + cardio exercises logged together).
export type DisciplineType = 'strength' | 'cardio' | 'climbing' | 'mixed'
export type CardioActivityType = 'run' | 'ride' | 'row' | 'other'
export type ClimbingStyle = 'bouldering' | 'top_rope' | 'lead'
export type WallAngle = 'slab' | 'vertical' | 'overhang'
// Physical character of a climb (A45) — supersedes WallAngle (a superset of it).
export type ClimbCharacter = 'slab' | 'vertical' | 'overhang' | 'roof' | 'cave' | 'crack'
export type TrackingType = 'reps' | 'duration' | 'distance'
// Discipline bucket an exercise belongs to (A36); 'rehab' is discipline-agnostic
// (A42); 'hangboard' (A73) is a training category whose exercises carry a
// hangboard protocol config and log as LoggedHang rather than LoggedSet.
export type ExerciseCategory = 'strength' | 'cardio' | 'climbing' | 'rehab' | 'hangboard'

// A94 — the disciplines a workout template can span. A template carries one or more
// of these in `categories` (multi-select); it appears under each in the Library.
// NB: this is deliberately NOT DisciplineType — there is no 'mixed' category (a
// multi-category template *is* the mixed case) and 'rehab' is a first-class option.
export type TemplateCategory = 'strength' | 'cardio' | 'climbing' | 'rehab'

// theCrag tick types — bouldering subset
export type BoulderTick = 'onsight' | 'flash' | 'send' | 'working' | 'repeat' | 'dab'

// theCrag tick types — roped subset (top rope + lead)
export type RopedTick =
  | 'onsight'
  | 'flash'
  | 'clean'
  | 'redpoint'
  | 'pink_point'
  | 'hang_dog'
  | 'attempt'
  | 'retreat'

export type ClimbingTick = BoulderTick | RopedTick

export type ClimbingKind = 'hangboard' | 'workout'
// Hangboard protocol type (A37). sub_max = sustained sub-maximal hang; max_hang =
// short near-max hang (added/assisted load); abrahang = Abrahamsson repeaters.
export type HangType = 'sub_max' | 'max_hang' | 'abrahang'

export type PRType = 'weight' | 'reps' | 'pace' | 'distance' | 'grade' | 'duration'

// ---------------------------------------------------------------------------
// Exercise library
// ---------------------------------------------------------------------------

// A98 — optional per-exercise default parameters. When set, they pre-fill the
// TemplateExercise / working-set fields as the exercise is added to a template or
// session, so standard parameters don't have to be re-entered each time. Which
// fields are meaningful follows the exercise's trackingType (reps → reps/weight;
// duration → durationSeconds; distance → distanceKm); all are optional and the
// add flow falls back to the hardcoded defaults (3 sets · 10 reps · 90s rest)
// for any that are unset. Hangboard exercises use `hangboard` (HangConfig) instead.
export interface ExerciseDefaults {
  sets?: number
  reps?: number
  weightKg?: number
  durationSeconds?: number
  distanceKm?: number
  restSeconds?: number
}

export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  muscleGroups: string[]
  trackingType: TrackingType
  tags: string[]
  notes?: string
  // Bodyweight movements that can carry extra load (pull-up, dip, …). When true,
  // set logging shows an "Additional weight" (+kg) field.
  supportsAdditionalWeight?: boolean
  // Hangboard exercises (A73, category 'hangboard') carry a default protocol
  // config; adding one to a training session seeds a HangboardSet from it.
  hangboard?: HangConfig
  // Default parameters used to pre-fill a new template/session row (A98).
  defaults?: ExerciseDefaults
  createdAt: number
}

// ---------------------------------------------------------------------------
// Workout templates
// ---------------------------------------------------------------------------

export interface TemplateExercise {
  exerciseId: string
  exerciseName: string // denormalised for display speed
  order: number // 0-indexed sort order
  defaultSets: number
  defaultReps?: number // undefined for duration/distance exercises
  defaultDuration?: number // seconds
  defaultWeight?: number // kg
  defaultDistanceKm?: number // target distance for a distance-tracked row (A98)
  defaultRestSeconds: number
  notes?: string
}

export interface IntervalStep {
  label: string // e.g. 'Hard', 'Easy'
  durationSeconds: number
}

// One round-group: its steps run in order, repeated `repeat` times.
export interface IntervalBlock {
  repeat: number
  steps: IntervalStep[]
}

// A hangboard protocol row (template-level).
export interface HangboardSet {
  id: string
  gripType: string
  hangType: HangType // A37 — defaults to 'sub_max' for legacy rows
  edgeDepthMm: number
  durationSeconds: number // hang duration (for abrahang: work per rep)
  weightKg: number // + added / - assisted
  sets: number // number of hangs
  restSeconds: number // inter-set rest
  // Abrahang-only (A37): reps per set (default 6) and the short intra-set rest
  // between reps (default 3s). durationSeconds is the work duration per rep.
  abrahangReps?: number
  intraRestSeconds?: number
  order: number
}

// The tunable part of a hangboard protocol, without its per-instance id/order.
// Used as an exercise's default hang config (Exercise.hangboard) and as the shape
// the shared HangConfigFields editor operates on.
export type HangConfig = Omit<HangboardSet, 'id' | 'order'>

export interface WorkoutTemplate {
  id: string
  name: string
  // A94/F46 — the disciplines this template spans; a template shows under each in
  // the Library. Source of truth for the ExercisePicker scope + card badges.
  categories: TemplateCategory[]
  /** @deprecated pre-F46 single discipline. Migrated into `categories` (v8) and
   *  cleared; kept optional only so legacy/backup records still read defensively. */
  type?: DisciplineType
  tags: string[]
  exercises: TemplateExercise[]
  // cardio-only fields
  cardioActivity?: CardioActivityType
  targetDurationSeconds?: number
  targetDistanceKm?: number
  intervals?: IntervalBlock[]
  // climbing-only fields
  climbingKind?: ClimbingKind
  hangboardSets?: HangboardSet[]
  lastUsedAt?: number
  createdAt: number
}

// ---------------------------------------------------------------------------
// Sessions (live copies of templates)
// ---------------------------------------------------------------------------

export interface WorkoutSession {
  id: string
  templateId?: string // undefined for freestyle / climbing sessions
  templateName: string // snapshot at session start (also the editable title, A68)
  titleRenamed?: boolean // user renamed the title (A68) — show it over the venue name
  type: DisciplineType
  startedAt: number
  endedAt?: number
  modifiedFromTemplate: boolean
  notes?: string
  // climbing-only metadata
  climbingVenue?: 'gym' | 'crag' | 'board' // which venue a quick-start session is; undefined for template/repeat sessions ('board' was formerly 'home', F30)
  gym?: string
  crag?: string
  board?: string // set (possibly '') for a board session; distinguishes it from gym/crag
  // Plan snapshot for a "repeat" session (created from a past session, not a
  // template). Session screens read these when there is no linked template.
  plannedExercises?: TemplateExercise[]
  plannedHangs?: HangboardSet[]
  plannedIntervals?: IntervalBlock[]
  plannedActivity?: CardioActivityType
  // Total time (ms) the session timer was explicitly paused. Persisted so an
  // unfinished session (A34) resumes its elapsed clock correctly after the app
  // is closed: elapsed = now - startedAt - pausedDuration.
  pausedDuration?: number
  // Heartbeat written every ~10s while a session screen is mounted (A48), so
  // resume detection can prefer a genuinely in-progress session over an orphaned
  // unfinished record. Absent on sessions created before heartbeats existed.
  lastActiveAt?: number
}

// ---------------------------------------------------------------------------
// Logged sets (strength)
// ---------------------------------------------------------------------------

export interface LoggedSet {
  id: string
  sessionId: string
  exerciseId: string
  exerciseName: string // denormalised
  setNumber: number // 1-indexed
  targetReps?: number
  actualReps?: number
  weightKg?: number
  additionalWeightKg?: number // extra load on a bodyweight movement (pull-up, dip, …)
  restTakenSeconds?: number
  durationSeconds?: number // for timed exercises
  distanceKm?: number // for a cardio exercise logged in a mixed session (A66)
  skipped: boolean
  swappedFrom?: string // original exerciseName if swapped
  loggedAt: number
}

// ---------------------------------------------------------------------------
// Logged cardio
// ---------------------------------------------------------------------------

export interface CompletedInterval {
  label: string
  durationSeconds: number
  order: number
}

export interface LoggedCardio {
  id: string
  sessionId: string
  activityType: CardioActivityType
  durationSeconds: number
  distanceKm?: number
  avgPaceSecondsPerKm?: number // computed on save
  intervals?: CompletedInterval[]
  loggedAt: number
}

// ---------------------------------------------------------------------------
// Climbing route logs (a climbing session is a WorkoutSession with type 'climbing')
// ---------------------------------------------------------------------------

// A logged hang (session-level).
export interface LoggedHang {
  id: string
  sessionId: string
  hangSetId?: string // FK → the HangboardSet row this hang belongs to
  gripType: string
  edgeDepthMm: number
  setNumber: number // 1-indexed
  targetDurationSeconds: number
  actualDurationSeconds?: number
  weightKg: number
  restTakenSeconds?: number
  hangType?: HangType // A37
  abrahangReps?: number // A37 — reps completed in an abrahang set
  skipped: boolean
  loggedAt: number
}

export interface ClimbingRoute {
  id: string
  sessionId: string // FK → WorkoutSession
  style: ClimbingStyle
  // Grade — one of these two is set depending on style
  vGrade?: string // 'V0'–'V17', 'VB'
  ewbanksGrade?: number // e.g. 18, 25, 33
  gymGrade?: number // gym-specific 0–35 scale (never conflated with vGrade/ewbanksGrade)
  feltLikeGrade?: string // optional "felt like" grade, stored as its display string
  wallAngle?: WallAngle // superseded by climbCharacter (A45); cleared when a route is saved
  climbCharacter?: ClimbCharacter // physical character of the climb (A45)
  climbStyles?: string[] // freeform style descriptors — crimpy, pumpy, … (A47)
  wallAngleDegrees?: number // Home board: -45 (slab) .. 0 (vertical) .. +90 (overhang); Gym 0–90
  heightMetres?: number // route height in metres (A44)
  routeName?: string
  colour?: string // gym tape colour
  routeType?: 'sport' | 'trad' // Crag lead/top-rope metadata only (A64)
  gymArea?: string // gym section/area this route is in (A69)
  tick: ClimbingTick
  attempts?: number
  falls?: number
  notes?: string
  loggedAt: number
}

// ---------------------------------------------------------------------------
// Planned workouts (calendar)
// ---------------------------------------------------------------------------

export interface PlannedWorkout {
  id: string
  templateId: string
  templateName: string // denormalised for display
  disciplineType: DisciplineType
  plannedDate: string // 'YYYY-MM-DD' (local)
  plannedTimeOfDay?: number // minutes since midnight
  notes?: string
  completedSessionId?: string // set when a matching session is logged that day
  createdAt: number
}

// ---------------------------------------------------------------------------
// Tag metadata (A35) — colour + default selection for exercise/template tags.
// The tag strings themselves live on Exercise.tags / WorkoutTemplate.tags; this
// table stores per-tag presentation and behaviour, keyed by the lowercased name.
// ---------------------------------------------------------------------------

export interface TagMeta {
  name: string // lowercased tag string (primary key)
  colour: string // hex from the fixed 12-colour palette (see lib/tagColors)
  isDefault?: boolean // pre-applied to new exercises / templates
  order: number // creation order — drives palette cycling
}

// ---------------------------------------------------------------------------
// Personal records
// ---------------------------------------------------------------------------

export interface PersonalRecord {
  id: string
  exerciseId?: string
  exerciseName: string // exercise name, or the climbing style label for grade PRs
  climbingStyle?: ClimbingStyle // set only for grade PRs
  prType: PRType
  value: number // grade PRs store V-grade sort index (VB = -1) or Ewbanks number
  unit: string // 'kg' | 'reps' | 's/km' | 'km' | 'ewbanks' | 'vgrade'
  sessionId: string
  achievedAt: number
}
