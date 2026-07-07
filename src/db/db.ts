import Dexie, { type Table } from 'dexie'
import { categoryForTracking, legacyTemplateToCategories } from '@/lib/migrations'
import type {
  Exercise,
  WorkoutTemplate,
  WorkoutSession,
  LoggedSet,
  LoggedCardio,
  ClimbingRoute,
  LoggedHang,
  PersonalRecord,
  PlannedWorkout,
  TagMeta,
} from '@/types'

export interface MetaRow {
  key: string
  value: unknown
}

// Compound indexes back the hot read paths — "last set for an exercise" and
// "sets/routes for a session ordered by time" — so they never sort in memory.
// v2 adds a small key/value `meta` table used to track built-in seed provenance.
export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, string>
  templates!: Table<WorkoutTemplate, string>
  sessions!: Table<WorkoutSession, string>
  sets!: Table<LoggedSet, string>
  cardio!: Table<LoggedCardio, string>
  routes!: Table<ClimbingRoute, string>
  hangs!: Table<LoggedHang, string>
  prs!: Table<PersonalRecord, string>
  plannedWorkouts!: Table<PlannedWorkout, string>
  tags!: Table<TagMeta, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('WorkoutTrackerDB')
    this.version(1).stores({
      exercises: '&id, name',
      templates: '&id, type, lastUsedAt',
      sessions: '&id, type, startedAt, templateId',
      sets: '&id, sessionId, [exerciseId+loggedAt], [sessionId+loggedAt]',
      cardio: '&id, sessionId',
      routes: '&id, [sessionId+loggedAt], style',
      prs: '&id, sessionId, [climbingStyle+prType], exerciseName, prType, achievedAt',
    })
    this.version(2).stores({
      meta: '&key',
    })
    // v3 adds hangboard hang logs.
    this.version(3).stores({
      hangs: '&id, sessionId, [sessionId+loggedAt]',
    })
    // v4 adds the calendar's planned workouts.
    this.version(4).stores({
      plannedWorkouts: '&id, plannedDate, templateId, completedSessionId',
    })
    // v5 adds per-tag metadata (colour + default selection). Keyed by name;
    // `isDefault` is a boolean (not an indexable key) so it stays unindexed.
    this.version(5).stores({
      tags: '&name, order',
    })
    // v6 adds a category index on exercises (A36) and backfills existing rows:
    // distance-tracked exercises are cardio, everything else strength.
    this.version(6)
      .stores({ exercises: '&id, name, category' })
      .upgrade(async (tx) => {
        await tx
          .table('exercises')
          .toCollection()
          .modify((e: { category?: string; trackingType?: string }) => {
            if (e.category == null) {
              e.category = categoryForTracking(e.trackingType)
            }
          })
      })
    // v7 (A73): merge hangboarding into training. A climbing session that is a
    // hangboard/workout (no route venue) becomes a training session, type
    // 'mixed', so it renders on the training session screen. Route sessions
    // (gym/crag/board — they carry a climbingVenue) keep type 'climbing'. Every
    // other table (sets, routes, hangs, …) is left completely untouched. A
    // per-record try/catch means one bad row is logged and skipped rather than
    // aborting the whole upgrade. Runs exactly once (Dexie versioning).
    this.version(7)
      .stores({ sessions: '&id, type, startedAt, templateId' })
      .upgrade(async (tx) => {
        await tx
          .table('sessions')
          .toCollection()
          .modify((s: { id?: string; type?: string; climbingVenue?: string }) => {
            try {
              if (s.type === 'climbing' && s.climbingVenue == null) {
                s.type = 'mixed'
              }
            } catch (err) {
              console.error('A73 session migration failed for record', s.id, err)
            }
          })
      })
    // v8 (A94/F46): templates move from a single `type` to `categories: []`. The
    // `type` index is dropped. Each template's legacy type maps to categories:
    // strength/cardio/climbing → [type]; 'mixed' is derived from its actual content
    // (the distinct exercise categories it contains, + 'climbing' for any hangboard
    // sets — A92); then `type` is cleared. Records already carrying `categories`
    // (created post-A94) are left untouched. Only the templates table is touched;
    // exercises are read (not modified) to classify 'mixed' templates. Per-record
    // try/catch: one bad row is logged and skipped, never aborting the upgrade.
    this.version(8)
      .stores({ templates: '&id, lastUsedAt' })
      .upgrade(async (tx) => {
        const exCat = new Map<string, string>()
        try {
          const exs = await tx.table('exercises').toArray()
          for (const e of exs as { id?: string; category?: string }[]) {
            if (e.id) exCat.set(e.id, e.category ?? 'strength')
          }
        } catch (err) {
          console.error('F46 could not load exercise categories', err)
        }
        await tx
          .table('templates')
          .toCollection()
          .modify(
            (t: {
              id?: string
              type?: string
              categories?: string[]
              exercises?: { exerciseId?: string }[]
              hangboardSets?: unknown[]
            }) => {
              try {
                if (Array.isArray(t.categories) && t.categories.length > 0) return // already migrated
                // Derive from the ACTUAL exercise content, not the coarse legacy
                // type (pre-F46 rehab-only / strength+rehab were stored as
                // type:'strength'). Shared with the import path (src/lib/migrations).
                t.categories = legacyTemplateToCategories(t, exCat)
                delete t.type
              } catch (err) {
                console.error('F46 template migration failed for record', t.id, err)
                // Best-effort fallback so the record still filters/renders.
                try {
                  if (!Array.isArray(t.categories) || t.categories.length === 0) {
                    t.categories = ['strength']
                    delete t.type
                  }
                } catch {
                  /* give up on this one row */
                }
              }
            },
          )
      })
  }
}

export const db = new WorkoutDB()
