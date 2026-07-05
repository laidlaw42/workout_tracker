# Data Model & Dexie Schema

## TypeScript types — `src/types/index.ts`

### Shared

```ts
export type DisciplineType = 'strength' | 'cardio' | 'climbing'
export type CardioActivityType = 'run' | 'ride' | 'row' | 'other'
export type ClimbingStyle = 'bouldering' | 'top_rope' | 'lead'
export type WallAngle = 'slab' | 'vertical' | 'overhang'

// theCrag tick types — bouldering subset
export type BoulderTick = 'onsight' | 'flash' | 'send' | 'working' | 'repeat' | 'dab'

// theCrag tick types — roped subset (top rope + lead)
export type RopedTick = 'onsight' | 'flash' | 'clean' | 'redpoint' | 'pink_point' | 'hang_dog' | 'attempt' | 'retreat'

export type ClimbingTick = BoulderTick | RopedTick

export type ClimbingKind = 'hangboard' | 'workout'  // climbing template flavours
```

### Exercise library

```ts
export interface Exercise {
  id: string                        // uuid or stable slug (ex_*) for built-ins
  name: string
  muscleGroups: string[]            // e.g. ['chest', 'triceps']
  trackingType: 'reps' | 'duration' | 'distance'
  tags: string[]                    // free-form, lower-cased on save
  notes?: string
  supportsAdditionalWeight?: boolean // bodyweight move that can carry extra load (pull-up, dip, …) → set logging shows a "+kg" field
  createdAt: number                 // timestamp ms
}
```

### Workout templates

```ts
export interface TemplateExercise {
  exerciseId: string
  exerciseName: string              // denormalised for display speed
  order: number                     // 0-indexed sort order
  defaultSets: number
  defaultReps?: number              // null for duration/distance exercises
  defaultDuration?: number          // seconds
  defaultWeight?: number            // kg
  defaultRestSeconds: number
  notes?: string
}

export interface WorkoutTemplate {
  id: string                        // uuid or stable slug (tpl_*) for built-ins
  name: string                      // e.g. 'Upper A'
  type: DisciplineType              // 'strength' | 'cardio' | 'climbing'
  tags: string[]                    // e.g. ['push', 'legs']
  exercises: TemplateExercise[]     // ordered array
  // cardio-only fields
  cardioActivity?: CardioActivityType
  targetDurationSeconds?: number
  targetDistanceKm?: number
  intervals?: IntervalBlock[]
  // climbing-only fields
  climbingKind?: ClimbingKind       // 'hangboard' | 'workout'
  hangboardSets?: HangboardSet[]
  lastUsedAt?: number
  createdAt: number
}

// A hangboard protocol row (one grip position × N hangs).
export interface HangboardSet {
  id: string
  gripType: string                  // e.g. 'Half crimp'
  edgeDepthMm: number
  durationSeconds: number           // hang duration
  weightKg: number                  // + added / - assisted
  sets: number                      // number of hangs
  restSeconds: number               // 180 repeaters / 300 max hangs (see 05_reference)
  order: number
}

// An interval block = one round-group. Its steps run in order, repeated `repeat`
// times, which cleanly expresses interleaved sets like 8×(2min hard / 1min easy).
// The cardio timer flattens IntervalBlock[] by expanding each block's steps `repeat` times.
export interface IntervalStep {
  label: string                     // e.g. 'Hard', 'Easy'
  durationSeconds: number
}

export interface IntervalBlock {
  repeat: number                    // number of rounds (1 for a plain warmup/cooldown)
  steps: IntervalStep[]             // steps performed each round, in order
}
```

### Sessions (live copies of templates)

```ts
export interface WorkoutSession {
  id: string                        // uuid
  templateId?: string               // undefined for freestyle / climbing sessions
  templateName: string              // snapshot at session start
  type: DisciplineType
  startedAt: number
  endedAt?: number
  modifiedFromTemplate: boolean
  notes?: string
  // climbing-only metadata (kept on the session — no separate climbing table)
  climbingVenue?: 'gym' | 'crag' | 'home'  // quick-start venue discriminator; undefined for template/repeat sessions
  gym?: string
  crag?: string
  board?: string                    // Home board name (may be '') — distinguishes a Home session from gym/crag
  // Plan snapshot for a "repeat" session (created from a past session, not a
  // template) and for mid-session cardio edits. Session screens read these when
  // there is no linked template.
  plannedExercises?: TemplateExercise[]
  plannedHangs?: HangboardSet[]
  plannedIntervals?: IntervalBlock[]
  plannedActivity?: CardioActivityType
  pausedDuration?: number            // total ms the timer was paused; lets an unfinished session (A34) resume its clock after a relaunch
}
```

### Logged sets (strength)

```ts
export interface LoggedSet {
  id: string                        // uuid
  sessionId: string
  exerciseId: string
  exerciseName: string              // denormalised
  setNumber: number                 // 1-indexed
  targetReps?: number
  actualReps?: number
  weightKg?: number
  additionalWeightKg?: number       // extra load on a bodyweight movement (pull-up, dip, …)
  restTakenSeconds?: number
  durationSeconds?: number          // for timed exercises
  skipped: boolean
  swappedFrom?: string              // original exerciseName if swapped
  loggedAt: number
}
```

### Logged cardio

```ts
export interface LoggedCardio {
  id: string
  sessionId: string
  activityType: CardioActivityType
  durationSeconds: number
  distanceKm?: number
  avgPaceSecondsPerKm?: number      // computed on save
  intervals?: CompletedInterval[]
  loggedAt: number
}

export interface CompletedInterval {
  label: string
  durationSeconds: number
  order: number
}
```

### Climbing route logs

A climbing session **is** a `WorkoutSession` with `type: 'climbing'` (plus optional `gym`/`crag`). Routes link directly to it via `sessionId` — there is no separate climbing-session table.

```ts
export interface ClimbingRoute {
  id: string
  sessionId: string                 // FK → WorkoutSession
  style: ClimbingStyle
  // Grade — one of these is set depending on style / grade system
  vGrade?: string                   // 'VB-'…'V17' (VB/V0 carry -/+ sub-grades)
  ewbanksGrade?: number             // e.g. 18, 25, 33
  gymGrade?: number                 // gym-specific 0–35 scale (never conflated with vGrade/ewbanksGrade)
  feltLikeGrade?: string            // optional "felt like" grade, stored as its display string
  wallAngle?: WallAngle             // enum for gym/crag
  wallAngleDegrees?: number         // Home board: -45 (slab) .. 0 (vertical) .. +90 (overhang)
  routeName?: string
  colour?: string                   // gym tape colour (Gym sessions only; lowercase, e.g. 'red', 'wood')
  tick: ClimbingTick
  attempts?: number
  falls?: number
  notes?: string
  loggedAt: number
}
```

### Personal records

```ts
export interface PersonalRecord {
  id: string
  exerciseId?: string               // strength/cardio PRs
  exerciseName: string              // exercise name, or the climbing style label for grade PRs
  climbingStyle?: ClimbingStyle     // set only for grade PRs; distinguishes bouldering vs roped
  prType: 'weight' | 'reps' | 'pace' | 'distance' | 'grade' | 'duration'  // 'duration' = longest hangboard hang
  value: number                     // grade PRs store a numeric grade: V-grade sort index (VB = -1) or Ewbanks number
  unit: string                      // 'kg', 'reps', 's/km', 'km', 'ewbanks', 'vgrade', 's'
  sessionId: string
  achievedAt: number
}
```

> Grade PRs are keyed by `climbingStyle` (bouldering uses `vgrade`, top_rope/lead use `ewbanks`), since V-grades and Ewbanks numbers are not comparable to each other.

### Logged hangs (hangboard)

```ts
export interface LoggedHang {
  id: string
  sessionId: string
  hangSetId?: string                // FK → the HangboardSet row this hang belongs to
  gripType: string
  edgeDepthMm: number
  setNumber: number                 // 1-indexed
  targetDurationSeconds: number
  actualDurationSeconds?: number
  weightKg: number
  restTakenSeconds?: number
  skipped: boolean
  loggedAt: number
}
```

> `hangSetId` scopes completion to a specific `HangboardSet` so two rows with identical grip/edge/duration advance independently.

### Tag metadata (A35)

Tag strings live on `Exercise.tags` / `WorkoutTemplate.tags`. This table stores per-tag presentation (colour) and behaviour (default selection), keyed by the lowercased name. Metadata is created lazily: `ensureTags()` runs on every exercise/template save and `syncAllTagMeta()` backfills at startup, each assigning the next of a fixed 12-colour palette (`src/lib/tagColors.ts`) in creation order.

```ts
export interface TagMeta {
  name: string                      // lowercased tag string (primary key)
  colour: string                    // hex from the 12-colour palette
  isDefault?: boolean               // pre-applied to new exercises / templates
  order: number                     // creation order — drives palette cycling + display sort
}
```

### Planned workouts (calendar)

```ts
export interface PlannedWorkout {
  id: string
  templateId: string
  templateName: string              // denormalised for display
  disciplineType: DisciplineType
  plannedDate: string               // 'YYYY-MM-DD' (local) — sorts/range-queries as a string
  plannedTimeOfDay?: number         // minutes since midnight
  notes?: string
  completedSessionId?: string       // set when a matching session is logged that day
  createdAt: number
}
```

---

## Dexie schema — `src/db/db.ts`

Nine data tables plus `meta`. Compound indexes back the hot read paths — "last set for an exercise" and "sets/routes/hangs for a session ordered by time" — so those never sort in memory.

```ts
import Dexie, { type Table } from 'dexie'
import type {
  Exercise, WorkoutTemplate, WorkoutSession,
  LoggedSet, LoggedCardio,
  ClimbingRoute, LoggedHang, PersonalRecord, PlannedWorkout
} from '@/types'

export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise>
  templates!: Table<WorkoutTemplate>
  sessions!: Table<WorkoutSession>
  sets!: Table<LoggedSet>
  cardio!: Table<LoggedCardio>
  routes!: Table<ClimbingRoute>
  hangs!: Table<LoggedHang>
  prs!: Table<PersonalRecord>
  plannedWorkouts!: Table<PlannedWorkout>
  meta!: Table<MetaRow>

  constructor() {
    super('WorkoutTrackerDB')
    this.version(1).stores({
      exercises: '&id, name',
      templates: '&id, type, lastUsedAt',
      sessions:  '&id, type, startedAt, templateId',
      sets:      '&id, sessionId, [exerciseId+loggedAt], [sessionId+loggedAt]',
      cardio:    '&id, sessionId',
      routes:    '&id, [sessionId+loggedAt], style',
      prs:       '&id, sessionId, [climbingStyle+prType], exerciseName, prType, achievedAt',
    })
    // v2 adds a small key/value meta table for built-in seed provenance.
    this.version(2).stores({ meta: '&key' })
    // v3 adds hangboard hang logs.
    this.version(3).stores({ hangs: '&id, sessionId, [sessionId+loggedAt]' })
    // v4 adds the calendar's planned workouts.
    this.version(4).stores({
      plannedWorkouts: '&id, plannedDate, templateId, completedSessionId',
    })
    // v5 adds per-tag metadata (colour + default selection). Keyed by name;
    // isDefault is a boolean (not an indexable key) so it stays unindexed.
    this.version(5).stores({ tags: '&name, order' })
  }
}

export const db = new WorkoutDB()
```

## DB helper functions — `src/db/helpers.ts`

Each helper is a typed async function. **Components import helpers, never `db` directly** — including for live reads, which are wrapped as `useLiveQuery(() => someHelper())`. Every read a screen needs therefore has a helper below.

IDs come from `generateId()` (see `src/lib/id.ts` below), not a bare `crypto.randomUUID()`, so the app still works in non-secure contexts. Timestamps are `Date.now()`.

Functions to implement (signatures only — bodies written in Phase 2):

```ts
// Exercises
export async function getAllExercises(): Promise<Exercise[]>
export async function upsertExercise(e: Omit<Exercise, 'id' | 'createdAt'>): Promise<string>
export async function updateExercise(id: string, updates: Partial<Omit<Exercise, 'id' | 'createdAt'>>): Promise<void>  // rename cascades to templates
export async function deleteExercise(id: string): Promise<void>

// Tags (A35) — colour + default-selection metadata
export async function getAllTags(): Promise<TagMeta[]>
export async function ensureTags(names: string[]): Promise<void>  // registers metadata for new tags with the next palette colour; idempotent. Called from upsert/updateExercise + upsertTemplate
export async function syncAllTagMeta(): Promise<void>  // backfills metadata for every tag in use (seed/import); called once at startup
export async function setTagColour(name: string, colour: string): Promise<void>
export async function setTagDefault(name: string, isDefault: boolean): Promise<void>
export async function getDefaultTags(): Promise<string[]>  // tag names pre-applied to new exercises/templates
export async function renameTag(oldName: string, newName: string): Promise<void>  // cascades to exercises + templates; merges if the new name exists
export async function deleteTag(name: string): Promise<void>  // removes the tag from every exercise/template, then drops its metadata

// Templates
export async function getAllTemplates(): Promise<WorkoutTemplate[]>
export async function getTemplatesByType(type?: DisciplineType): Promise<WorkoutTemplate[]>
export async function getTemplate(id: string): Promise<WorkoutTemplate | undefined>
export async function upsertTemplate(t: Omit<WorkoutTemplate, 'id' | 'createdAt'> & { id?: string }): Promise<string>
export async function deleteTemplate(id: string): Promise<void>
export async function markTemplateUsed(id: string): Promise<void>  // bump lastUsedAt on start

// Sessions
export async function createSession(s: Omit<WorkoutSession, 'id'>): Promise<string>
export async function updateSession(id: string, updates: Partial<WorkoutSession>): Promise<void>  // notes, gym, crag
export async function endSession(id: string): Promise<void>
export async function deleteSession(id: string): Promise<void>  // cascades to sets/cardio/routes/prs
export async function getRecentSessions(limit?: number): Promise<WorkoutSession[]>
export async function getAllSessions(type?: DisciplineType): Promise<WorkoutSession[]>  // ordered by startedAt desc; for History
export async function getSessionById(id: string): Promise<WorkoutSession | undefined>
export async function getUnfinishedSession(): Promise<WorkoutSession | undefined>  // most recent session with no endedAt — Home resume banner (A34)
export async function describeSessions(sessions: WorkoutSession[]): Promise<Record<string, SessionKind>>  // classifies each by logged content (cardio activity / distinct climb styles / hangboard / workout) for History + Recents badges
export async function repeatSession(sourceId: string): Promise<string>  // "use as workout" — snapshots a past session's plan onto a new one
// endSession() also best-effort links a same-day, same-template PlannedWorkout via completedSessionId

// Sets
export async function addSet(s: Omit<LoggedSet, 'id'>): Promise<string>
export async function updateSet(id: string, updates: Partial<LoggedSet>): Promise<void>
export async function deleteSet(id: string): Promise<void>
export async function getSetsForSession(sessionId: string): Promise<LoggedSet[]>
export async function getSetsForExercise(exerciseId: string): Promise<LoggedSet[]>  // all sessions, for Progress charts
export async function getExerciseIdsWithSets(): Promise<string[]>  // distinct exerciseIds with ≥1 logged set — filters the Progress strength picker (F17)
export async function getLastSetForExercise(exerciseId: string): Promise<LoggedSet | undefined>

// Cardio
export async function addCardio(c: Omit<LoggedCardio, 'id'>): Promise<string>
export async function updateCardio(id: string, updates: Partial<LoggedCardio>): Promise<void>
export async function getCardioForSession(sessionId: string): Promise<LoggedCardio | undefined>
export async function getCardioByActivity(activity: CardioActivityType): Promise<LoggedCardio[]>  // Progress charts

// Climbing routes (a climbing session is just a WorkoutSession with type 'climbing')
export async function addRoute(r: Omit<ClimbingRoute, 'id'>): Promise<string>
export async function updateRoute(id: string, updates: Partial<ClimbingRoute>): Promise<void>
export async function deleteRoute(id: string): Promise<void>
export async function getRoutesForSession(sessionId: string): Promise<ClimbingRoute[]>
export async function getAllRoutes(): Promise<ClimbingRoute[]>  // Progress grade pyramid

// Hangboard hangs (climbing templates: hangboard + climbing-workout kinds)
export async function addHang(h: Omit<LoggedHang, 'id'>): Promise<string>
export async function updateHang(id: string, updates: Partial<LoggedHang>): Promise<void>
export async function deleteHang(id: string): Promise<void>
export async function getHangsForSession(sessionId: string): Promise<LoggedHang[]>
export async function getAllHangs(): Promise<LoggedHang[]>  // Progress hangboard charts

// PRs
export async function checkAndSavePR(candidate: Omit<PersonalRecord, 'id'>): Promise<boolean>
export async function getPRsForExercise(exerciseName: string): Promise<PersonalRecord[]>
export async function getPRsForSession(sessionId: string): Promise<PersonalRecord[]>  // for the summary screen
export async function getGradePRForStyle(style: ClimbingStyle): Promise<PersonalRecord | undefined>

// Planned workouts (calendar)
export async function getPlannedWorkoutsForRange(from: string, to: string): Promise<PlannedWorkout[]>
export async function addPlannedWorkout(p: Omit<PlannedWorkout, 'id' | 'createdAt'>): Promise<string>
export async function updatePlannedWorkout(id: string, updates: Partial<PlannedWorkout>): Promise<void>
export async function deletePlannedWorkout(id: string): Promise<void>
export async function linkPlanToSession(plannedId: string, sessionId: string): Promise<void>

// Export / import / data management
export async function exportAllData(): Promise<string>   // JSON string; includes plannedWorkouts + tags
export async function importAllData(json: string): Promise<void>  // REPLACE — one Dexie transaction
export async function mergeData(json: string): Promise<{ inserted: number; skipped: number }>  // additive; skips existing ids, re-runs PR detection
export async function clearAllData(): Promise<void>  // clears every table (incl. meta) → re-seeds next launch
export async function restoreDefaults(): Promise<void>  // re-inserts any missing built-in exercises/templates by id; edited/user records untouched
```

## ID generation — `src/lib/id.ts`

```ts
// crypto.randomUUID() is only defined in a secure context (HTTPS or localhost).
// LAN device testing over plain http would otherwise crash, so fall back.
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
```

## Seed data — `src/db/seed.ts`

Built-in exercises and templates use **stable slug ids** (`ex_*`, `tpl_*`) so the starter library can grow over time. `seedIfNeeded()` is idempotent, additive, and respects user curation, all inside one `db.transaction('rw', …)`:

- **Exercises** are seeded once each (`meta.seededExerciseIds`), so a user-deleted exercise is never re-seeded and user edits are never clobbered.
- **Templates** are seeded once each: the `meta` key `seededTemplateIds` records every built-in ever seeded, so a new build adds only the new ids and a user-deleted starter is never resurrected.
- A one-time **legacy migration** (`meta.legacyMigrated`) removes the original uuid-id starter set, replaced by the stable-id set. User-created templates (uuid ids, non-starter names) are untouched.

The built-in set is science-based / proven splits: Push/Pull/Legs A+B, Upper/Lower, Full Body A/B, plus Easy run, Tempo run, Zone 2 ride, Interval ride, Rowing intervals, and two hangboard protocols (Repeaters @180s, Max hangs @300s). Strength rest defaults and hangboard rest values are literature-based (see `05_reference` / comments in `seed.ts`). `BUILTIN_SET_VERSION` bumps trigger a one-time refresh of existing built-ins (preserving `createdAt`/`lastUsedAt`).

**Exercise library to seed** (minimum viable set):

Strength: Squat, Romanian deadlift, Leg press, Leg curl, Hip thrust, Bench press, Incline dumbbell press, Cable fly, Overhead press, Lateral raise, Pull-up, Lat pulldown, Seated row, Face pull, Bicep curl, Tricep pushdown, Plank

Cardio: Run, Ride, Row

**Templates to seed:**

- Push A: Bench press 4×8, Overhead press 3×10, Incline DB press 3×12, Lateral raise 3×15, Tricep pushdown 3×15
- Pull A: Pull-up 4×6, Seated row 4×10, Lat pulldown 3×12, Face pull 3×15, Bicep curl 3×12
- Legs A: Squat 4×6, Romanian deadlift 3×10, Leg press 3×12, Leg curl 3×12, Hip thrust 3×10
- Easy run: 30 min, no intervals
- Interval ride: 5 min warmup + 8×(2 min hard / 1 min easy) + 5 min cooldown
