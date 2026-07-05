// ---------------------------------------------------------------------------
// Shared enums / unions
// ---------------------------------------------------------------------------

export type DisciplineType = 'strength' | 'cardio' | 'climbing'
export type CardioActivityType = 'run' | 'ride' | 'row' | 'other'
export type ClimbingStyle = 'bouldering' | 'top_rope' | 'lead'
export type WallAngle = 'slab' | 'vertical' | 'overhang'
export type TrackingType = 'reps' | 'duration' | 'distance'

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

export type PRType = 'weight' | 'reps' | 'pace' | 'distance' | 'grade' | 'duration'

// ---------------------------------------------------------------------------
// Exercise library
// ---------------------------------------------------------------------------

export interface Exercise {
  id: string
  name: string
  muscleGroups: string[]
  trackingType: TrackingType
  tags: string[]
  notes?: string
  // Bodyweight movements that can carry extra load (pull-up, dip, …). When true,
  // set logging shows an "Additional weight" (+kg) field.
  supportsAdditionalWeight?: boolean
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
  edgeDepthMm: number
  durationSeconds: number // hang duration
  weightKg: number // + added / - assisted
  sets: number // number of hangs
  restSeconds: number
  order: number
}

export interface WorkoutTemplate {
  id: string
  name: string
  type: DisciplineType
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
  templateName: string // snapshot at session start
  type: DisciplineType
  startedAt: number
  endedAt?: number
  modifiedFromTemplate: boolean
  notes?: string
  // climbing-only metadata
  climbingVenue?: 'gym' | 'crag' | 'home' // which venue a quick-start session is; undefined for template/repeat sessions
  gym?: string
  crag?: string
  board?: string // set (possibly '') for a "Home" board session; distinguishes it from gym/crag
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
  wallAngle?: WallAngle
  wallAngleDegrees?: number // Home board: -45 (slab) .. 0 (vertical) .. +90 (overhang)
  routeName?: string
  colour?: string // gym tape colour
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
