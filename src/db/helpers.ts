import Dexie from 'dexie'
import { db } from './db'
import { generateId } from '@/lib/id'
import type {
  CardioActivityType,
  ClimbingRoute,
  ClimbingStyle,
  DisciplineType,
  Exercise,
  LoggedCardio,
  LoggedHang,
  LoggedSet,
  PersonalRecord,
  PRType,
  WorkoutSession,
  WorkoutTemplate,
} from '@/types'

// Wrap every DB op so failures surface with a descriptive message instead of a
// bare Dexie error. Helpers stay UI-agnostic — callers show the toast.
async function run<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    throw new Error(`[db] ${label} failed: ${(err as Error).message}`, { cause: err })
  }
}

const MIN = Dexie.minKey
const MAX = Dexie.maxKey

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export async function getAllExercises(): Promise<Exercise[]> {
  return run('getAllExercises', async () => {
    const all = await db.exercises.toArray()
    return all.sort((a, b) => a.name.localeCompare(b.name))
  })
}

export async function upsertExercise(
  e: Omit<Exercise, 'id' | 'createdAt'>,
): Promise<string> {
  return run('upsertExercise', async () => {
    const id = generateId()
    await db.exercises.put({ ...e, id, createdAt: Date.now() })
    return id
  })
}

// Updates an exercise; a rename cascades to templates' denormalised names so
// they stay in sync. Historical sets/routes keep their recorded names.
export async function updateExercise(
  id: string,
  updates: Partial<Omit<Exercise, 'id' | 'createdAt'>>,
): Promise<void> {
  return run('updateExercise', async () => {
    await db.transaction('rw', [db.exercises, db.templates], async () => {
      await db.exercises.update(id, updates)
      if (updates.name) {
        const templates = await db.templates.toArray()
        for (const t of templates) {
          if (t.exercises.some((e) => e.exerciseId === id)) {
            await db.templates.update(t.id, {
              exercises: t.exercises.map((e) =>
                e.exerciseId === id ? { ...e, exerciseName: updates.name! } : e,
              ),
            })
          }
        }
      }
    })
  })
}

export async function deleteExercise(id: string): Promise<void> {
  return run('deleteExercise', () => db.exercises.delete(id))
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function getAllTemplates(): Promise<WorkoutTemplate[]> {
  return getTemplatesByType(undefined)
}

export async function getTemplatesByType(
  type?: DisciplineType,
): Promise<WorkoutTemplate[]> {
  return run('getTemplatesByType', async () => {
    const list = type
      ? await db.templates.where('type').equals(type).toArray()
      : await db.templates.toArray()
    // Most-recently-used first, then alphabetical; never-used sink to the bottom.
    return list.sort(
      (a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name),
    )
  })
}

export async function getTemplate(id: string): Promise<WorkoutTemplate | undefined> {
  return run('getTemplate', () => db.templates.get(id))
}

export async function upsertTemplate(
  t: Omit<WorkoutTemplate, 'id' | 'createdAt'> & { id?: string },
): Promise<string> {
  return run('upsertTemplate', async () => {
    const id = t.id ?? generateId()
    const existing = t.id ? await db.templates.get(t.id) : undefined
    const record: WorkoutTemplate = {
      id,
      name: t.name,
      type: t.type,
      tags: t.tags,
      exercises: t.exercises,
      cardioActivity: t.cardioActivity,
      targetDurationSeconds: t.targetDurationSeconds,
      targetDistanceKm: t.targetDistanceKm,
      intervals: t.intervals,
      climbingKind: t.climbingKind,
      hangboardSets: t.hangboardSets,
      lastUsedAt: t.lastUsedAt,
      createdAt: existing?.createdAt ?? Date.now(),
    }
    await db.templates.put(record)
    return id
  })
}

export async function deleteTemplate(id: string): Promise<void> {
  return run('deleteTemplate', () => db.templates.delete(id))
}

export async function markTemplateUsed(id: string): Promise<void> {
  return run('markTemplateUsed', async () => {
    await db.templates.update(id, { lastUsedAt: Date.now() })
  })
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(s: Omit<WorkoutSession, 'id'>): Promise<string> {
  return run('createSession', async () => {
    const id = generateId()
    await db.sessions.put({ ...s, id })
    return id
  })
}

export async function updateSession(
  id: string,
  updates: Partial<WorkoutSession>,
): Promise<void> {
  return run('updateSession', async () => {
    await db.sessions.update(id, updates)
  })
}

export async function endSession(id: string): Promise<void> {
  return run('endSession', async () => {
    await db.sessions.update(id, { endedAt: Date.now() })
  })
}

// Deletes a session and everything logged under it.
export async function deleteSession(id: string): Promise<void> {
  return run('deleteSession', async () => {
    await db.transaction(
      'rw',
      [db.sessions, db.sets, db.cardio, db.routes, db.hangs, db.prs],
      async () => {
        await db.sessions.delete(id)
        await db.sets.where('sessionId').equals(id).delete()
        await db.cardio.where('sessionId').equals(id).delete()
        await db.routes.filter((r) => r.sessionId === id).delete()
        await db.hangs.where('sessionId').equals(id).delete()
        await db.prs.where('sessionId').equals(id).delete()
      },
    )
  })
}

export async function getRecentSessions(limit = 5): Promise<WorkoutSession[]> {
  return run('getRecentSessions', () =>
    db.sessions.orderBy('startedAt').reverse().limit(limit).toArray(),
  )
}

export async function getAllSessions(type?: DisciplineType): Promise<WorkoutSession[]> {
  return run('getAllSessions', async () => {
    const list = type
      ? await db.sessions.where('type').equals(type).toArray()
      : await db.sessions.toArray()
    return list.sort((a, b) => b.startedAt - a.startedAt)
  })
}

export async function getSessionById(id: string): Promise<WorkoutSession | undefined> {
  return run('getSessionById', () => db.sessions.get(id))
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

export async function addSet(s: Omit<LoggedSet, 'id'>): Promise<string> {
  return run('addSet', async () => {
    const id = generateId()
    await db.sets.put({ ...s, id })
    return id
  })
}

export async function updateSet(id: string, updates: Partial<LoggedSet>): Promise<void> {
  return run('updateSet', async () => {
    await db.sets.update(id, updates)
  })
}

export async function deleteSet(id: string): Promise<void> {
  return run('deleteSet', () => db.sets.delete(id))
}

export async function getSetsForSession(sessionId: string): Promise<LoggedSet[]> {
  return run('getSetsForSession', () =>
    db.sets
      .where('[sessionId+loggedAt]')
      .between([sessionId, MIN], [sessionId, MAX])
      .toArray(),
  )
}

export async function getSetsForExercise(exerciseId: string): Promise<LoggedSet[]> {
  return run('getSetsForExercise', () =>
    db.sets
      .where('[exerciseId+loggedAt]')
      .between([exerciseId, MIN], [exerciseId, MAX])
      .toArray(),
  )
}

export async function getLastSetForExercise(
  exerciseId: string,
): Promise<LoggedSet | undefined> {
  return run('getLastSetForExercise', async () => {
    const sets = await db.sets
      .where('[exerciseId+loggedAt]')
      .between([exerciseId, MIN], [exerciseId, MAX])
      .toArray()
    // Most recent logged, non-skipped set that recorded a weight (for pre-fill).
    for (let i = sets.length - 1; i >= 0; i--) {
      if (!sets[i].skipped && sets[i].weightKg != null) return sets[i]
    }
    return undefined
  })
}

// ---------------------------------------------------------------------------
// Cardio
// ---------------------------------------------------------------------------

export async function addCardio(c: Omit<LoggedCardio, 'id'>): Promise<string> {
  return run('addCardio', async () => {
    const id = generateId()
    await db.cardio.put({ ...c, id })
    return id
  })
}

export async function getCardioForSession(
  sessionId: string,
): Promise<LoggedCardio | undefined> {
  return run('getCardioForSession', () =>
    db.cardio.where('sessionId').equals(sessionId).first(),
  )
}

export async function updateCardio(
  id: string,
  updates: Partial<LoggedCardio>,
): Promise<void> {
  return run('updateCardio', async () => {
    await db.cardio.update(id, updates)
  })
}

export async function getCardioByActivity(
  activity: CardioActivityType,
): Promise<LoggedCardio[]> {
  return run('getCardioByActivity', async () => {
    const all = await db.cardio.toArray()
    return all
      .filter((c) => c.activityType === activity)
      .sort((a, b) => a.loggedAt - b.loggedAt)
  })
}

// ---------------------------------------------------------------------------
// Climbing routes
// ---------------------------------------------------------------------------

export async function addRoute(r: Omit<ClimbingRoute, 'id'>): Promise<string> {
  return run('addRoute', async () => {
    const id = generateId()
    await db.routes.put({ ...r, id })
    return id
  })
}

export async function updateRoute(
  id: string,
  updates: Partial<ClimbingRoute>,
): Promise<void> {
  return run('updateRoute', async () => {
    await db.routes.update(id, updates)
  })
}

export async function deleteRoute(id: string): Promise<void> {
  return run('deleteRoute', () => db.routes.delete(id))
}

export async function getRoutesForSession(sessionId: string): Promise<ClimbingRoute[]> {
  // Most recent first.
  return run('getRoutesForSession', () =>
    db.routes
      .where('[sessionId+loggedAt]')
      .between([sessionId, MIN], [sessionId, MAX])
      .reverse()
      .toArray(),
  )
}

export async function getAllRoutes(): Promise<ClimbingRoute[]> {
  return run('getAllRoutes', () => db.routes.toArray())
}

// ---------------------------------------------------------------------------
// Hangboard hangs
// ---------------------------------------------------------------------------

export async function addHang(h: Omit<LoggedHang, 'id'>): Promise<string> {
  return run('addHang', async () => {
    const id = generateId()
    await db.hangs.put({ ...h, id })
    return id
  })
}

export async function updateHang(id: string, updates: Partial<LoggedHang>): Promise<void> {
  return run('updateHang', async () => {
    await db.hangs.update(id, updates)
  })
}

export async function deleteHang(id: string): Promise<void> {
  return run('deleteHang', () => db.hangs.delete(id))
}

export async function getHangsForSession(sessionId: string): Promise<LoggedHang[]> {
  return run('getHangsForSession', () =>
    db.hangs
      .where('[sessionId+loggedAt]')
      .between([sessionId, MIN], [sessionId, MAX])
      .toArray(),
  )
}

// ---------------------------------------------------------------------------
// Personal records
// ---------------------------------------------------------------------------

function beatsExisting(prType: PRType, value: number, existing: PersonalRecord[]): boolean {
  if (existing.length === 0) return true
  const values = existing.map((p) => p.value)
  // Pace: lower is better. Everything else: higher is better.
  return prType === 'pace' ? value < Math.min(...values) : value > Math.max(...values)
}

// The caller evaluates the domain PR conditions (reps met, etc.) and passes a
// candidate; this persists it only if it beats the stored best for its key.
export async function checkAndSavePR(
  candidate: Omit<PersonalRecord, 'id'>,
): Promise<boolean> {
  return run('checkAndSavePR', async () => {
    const existing =
      candidate.prType === 'grade' && candidate.climbingStyle
        ? await db.prs
            .where('[climbingStyle+prType]')
            .equals([candidate.climbingStyle, 'grade'])
            .toArray()
        : await db.prs
            .where('exerciseName')
            .equals(candidate.exerciseName)
            .filter((p) => p.prType === candidate.prType)
            .toArray()

    if (!beatsExisting(candidate.prType, candidate.value, existing)) return false
    await db.prs.put({ ...candidate, id: generateId() })
    return true
  })
}

export async function getPRsForExercise(exerciseName: string): Promise<PersonalRecord[]> {
  return run('getPRsForExercise', async () => {
    const list = await db.prs.where('exerciseName').equals(exerciseName).toArray()
    return list.sort((a, b) => b.achievedAt - a.achievedAt)
  })
}

export async function getPRsForSession(sessionId: string): Promise<PersonalRecord[]> {
  return run('getPRsForSession', () =>
    db.prs.where('sessionId').equals(sessionId).toArray(),
  )
}

export async function getGradePRForStyle(
  style: ClimbingStyle,
): Promise<PersonalRecord | undefined> {
  return run('getGradePRForStyle', async () => {
    const list = await db.prs
      .where('[climbingStyle+prType]')
      .equals([style, 'grade'])
      .toArray()
    return list.reduce<PersonalRecord | undefined>(
      (best, p) => (best === undefined || p.value > best.value ? p : best),
      undefined,
    )
  })
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

interface ExportBundle {
  version: number
  exportedAt: number
  data: {
    exercises: Exercise[]
    templates: WorkoutTemplate[]
    sessions: WorkoutSession[]
    sets: LoggedSet[]
    cardio: LoggedCardio[]
    routes: ClimbingRoute[]
    hangs: LoggedHang[]
    prs: PersonalRecord[]
  }
}

export async function exportAllData(): Promise<string> {
  return run('exportAllData', async () => {
    const [exercises, templates, sessions, sets, cardio, routes, hangs, prs] =
      await Promise.all([
        db.exercises.toArray(),
        db.templates.toArray(),
        db.sessions.toArray(),
        db.sets.toArray(),
        db.cardio.toArray(),
        db.routes.toArray(),
        db.hangs.toArray(),
        db.prs.toArray(),
      ])
    const bundle: ExportBundle = {
      version: 1,
      exportedAt: Date.now(),
      data: { exercises, templates, sessions, sets, cardio, routes, hangs, prs },
    }
    return JSON.stringify(bundle)
  })
}

export async function importAllData(json: string): Promise<void> {
  return run('importAllData', async () => {
    const parsed = JSON.parse(json) as Partial<ExportBundle>
    const d = parsed.data
    if (!d || typeof d !== 'object') {
      throw new Error('unrecognised backup file (missing "data")')
    }
    // Atomic: a bad file never leaves a half-wiped DB.
    await db.transaction(
      'rw',
      [db.exercises, db.templates, db.sessions, db.sets, db.cardio, db.routes, db.hangs, db.prs],
      async () => {
        await Promise.all([
          db.exercises.clear(),
          db.templates.clear(),
          db.sessions.clear(),
          db.sets.clear(),
          db.cardio.clear(),
          db.routes.clear(),
          db.hangs.clear(),
          db.prs.clear(),
        ])
        if (d.exercises?.length) await db.exercises.bulkAdd(d.exercises)
        if (d.templates?.length) await db.templates.bulkAdd(d.templates)
        if (d.sessions?.length) await db.sessions.bulkAdd(d.sessions)
        if (d.sets?.length) await db.sets.bulkAdd(d.sets)
        if (d.cardio?.length) await db.cardio.bulkAdd(d.cardio)
        if (d.routes?.length) await db.routes.bulkAdd(d.routes)
        if (d.hangs?.length) await db.hangs.bulkAdd(d.hangs)
        if (d.prs?.length) await db.prs.bulkAdd(d.prs)
      },
    )
  })
}
