import Dexie, { type Table } from 'dexie'
import type {
  Exercise,
  WorkoutTemplate,
  WorkoutSession,
  LoggedSet,
  LoggedCardio,
  ClimbingRoute,
  PersonalRecord,
} from '@/types'

// Seven tables. Compound indexes back the hot read paths — "last set for an
// exercise" and "sets/routes for a session ordered by time" — so they never
// sort in memory.
export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, string>
  templates!: Table<WorkoutTemplate, string>
  sessions!: Table<WorkoutSession, string>
  sets!: Table<LoggedSet, string>
  cardio!: Table<LoggedCardio, string>
  routes!: Table<ClimbingRoute, string>
  prs!: Table<PersonalRecord, string>

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
  }
}

export const db = new WorkoutDB()
