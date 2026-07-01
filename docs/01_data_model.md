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
```

### Exercise library

```ts
export interface Exercise {
  id: string                        // uuid
  name: string
  muscleGroups: string[]            // e.g. ['chest', 'triceps']
  trackingType: 'reps' | 'duration' | 'distance'
  notes?: string
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
  id: string                        // uuid
  name: string                      // e.g. 'Upper A'
  type: 'strength' | 'cardio'
  tags: string[]                    // e.g. ['push', 'legs']
  exercises: TemplateExercise[]     // ordered array
  // cardio-only fields
  cardioActivity?: CardioActivityType
  targetDurationSeconds?: number
  targetDistanceKm?: number
  intervals?: IntervalBlock[]
  lastUsedAt?: number
  createdAt: number
}

export interface IntervalBlock {
  label: string                     // e.g. 'work', 'rest'
  durationSeconds: number
  repeatCount: number
}
```

### Sessions (live copies of templates)

```ts
export interface WorkoutSession {
  id: string                        // uuid
  templateId?: string               // null for freestyle sessions
  templateName: string              // snapshot at session start
  type: DisciplineType
  startedAt: number
  endedAt?: number
  modifiedFromTemplate: boolean
  notes?: string
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

### Climbing sessions & route logs

```ts
export interface ClimbingSession {
  id: string
  sessionId: string                 // FK → WorkoutSession
  gym?: string
  crag?: string
  loggedAt: number
}

export interface ClimbingRoute {
  id: string
  climbingSessionId: string
  style: ClimbingStyle
  // Grade — one of these two is set depending on style
  vGrade?: string                   // 'V0'–'V17', 'VB'
  ewbanksGrade?: number             // e.g. 18, 25, 33
  wallAngle?: WallAngle
  routeName?: string
  colour?: string                   // gym tape colour
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
  exerciseId?: string               // strength PRs
  exerciseName: string
  prType: 'weight' | 'reps' | 'pace' | 'distance' | 'grade'
  value: number
  unit: string                      // 'kg', 'reps', 's/km', 'km', 'ewbanks', 'vgrade'
  sessionId: string
  achievedAt: number
}
```

---

## Dexie schema — `src/db/db.ts`

```ts
import Dexie, { type Table } from 'dexie'
import type {
  Exercise, WorkoutTemplate, WorkoutSession,
  LoggedSet, LoggedCardio, ClimbingSession,
  ClimbingRoute, PersonalRecord
} from '@/types'

export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise>
  templates!: Table<WorkoutTemplate>
  sessions!: Table<WorkoutSession>
  sets!: Table<LoggedSet>
  cardio!: Table<LoggedCardio>
  climbingSessions!: Table<ClimbingSession>
  routes!: Table<ClimbingRoute>
  prs!: Table<PersonalRecord>

  constructor() {
    super('WorkoutTrackerDB')
    this.version(1).stores({
      exercises:        '&id, name',
      templates:        '&id, type, lastUsedAt',
      sessions:         '&id, type, startedAt, templateId',
      sets:             '&id, sessionId, exerciseId, loggedAt',
      cardio:           '&id, sessionId',
      climbingSessions: '&id, sessionId',
      routes:           '&id, climbingSessionId, style, loggedAt',
      prs:              '&id, exerciseName, prType, achievedAt',
    })
  }
}

export const db = new WorkoutDB()
```

## DB helper functions — `src/db/helpers.ts`

Each helper is a typed async function. Components import helpers, never `db` directly.

Functions to implement (signatures only — bodies written in Phase 2):

```ts
// Exercises
export async function getAllExercises(): Promise<Exercise[]>
export async function upsertExercise(e: Omit<Exercise, 'id' | 'createdAt'>): Promise<string>

// Templates
export async function getAllTemplates(): Promise<WorkoutTemplate[]>
export async function getTemplate(id: string): Promise<WorkoutTemplate | undefined>
export async function upsertTemplate(t: Omit<WorkoutTemplate, 'id' | 'createdAt'>): Promise<string>
export async function deleteTemplate(id: string): Promise<void>

// Sessions
export async function createSession(s: Omit<WorkoutSession, 'id'>): Promise<string>
export async function endSession(id: string): Promise<void>
export async function getRecentSessions(limit?: number): Promise<WorkoutSession[]>
export async function getSessionById(id: string): Promise<WorkoutSession | undefined>

// Sets
export async function addSet(s: Omit<LoggedSet, 'id'>): Promise<string>
export async function updateSet(id: string, updates: Partial<LoggedSet>): Promise<void>
export async function getSetsForSession(sessionId: string): Promise<LoggedSet[]>
export async function getLastSetForExercise(exerciseId: string): Promise<LoggedSet | undefined>

// Cardio
export async function addCardio(c: Omit<LoggedCardio, 'id'>): Promise<string>
export async function getCardioForSession(sessionId: string): Promise<LoggedCardio | undefined>

// Climbing
export async function createClimbingSession(cs: Omit<ClimbingSession, 'id'>): Promise<string>
export async function addRoute(r: Omit<ClimbingRoute, 'id'>): Promise<string>
export async function updateRoute(id: string, updates: Partial<ClimbingRoute>): Promise<void>
export async function getRoutesForClimbingSession(climbingSessionId: string): Promise<ClimbingRoute[]>

// PRs
export async function checkAndSavePR(candidate: Omit<PersonalRecord, 'id'>): Promise<boolean>
export async function getPRsForExercise(exerciseName: string): Promise<PersonalRecord[]>

// Export / import
export async function exportAllData(): Promise<string>   // returns JSON string
export async function importAllData(json: string): Promise<void>
```

## Seed data — `src/db/seed.ts`

Pre-built exercise library and workout templates loaded on first run (detected via `localStorage` flag `'seeded'`).

**Exercise library to seed** (minimum viable set):

Strength: Squat, Romanian deadlift, Leg press, Leg curl, Hip thrust, Bench press, Incline dumbbell press, Cable fly, Overhead press, Lateral raise, Pull-up, Lat pulldown, Seated row, Face pull, Bicep curl, Tricep pushdown, Plank

Cardio: Run, Ride, Row

**Templates to seed:**

- Push A: Bench press 4×8, Overhead press 3×10, Incline DB press 3×12, Lateral raise 3×15, Tricep pushdown 3×15
- Pull A: Pull-up 4×6, Seated row 4×10, Lat pulldown 3×12, Face pull 3×15, Bicep curl 3×12
- Legs A: Squat 4×6, Romanian deadlift 3×10, Leg press 3×12, Leg curl 3×12, Hip thrust 3×10
- Easy run: 30 min, no intervals
- Interval ride: 5 min warmup + 8×(2 min hard / 1 min easy) + 5 min cooldown
