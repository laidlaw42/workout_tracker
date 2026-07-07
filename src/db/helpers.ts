import Dexie from 'dexie'
import { db } from './db'
import { generateId } from '@/lib/id'
import { normalizeTags } from '@/lib/tags'
import { paletteColourForOrder } from '@/lib/tagColors'
import { STYLE_LABELS, isCleanTick, vGradeIndex } from '@/lib/climbing'
import { deriveSessionKind, normalizeVenue, type SessionKind } from '@/lib/badges'
import { deriveSessionType, templateCategories } from '@/lib/templateCategories'
import { templateExerciseFromExercise } from '@/lib/exerciseDefaults'
import { clearAllActivePhases } from '@/lib/activePhase'
import { repsMet, weightPrValue } from '@/lib/pr'
import type {
  CardioActivityType,
  ClimbingRoute,
  ClimbingStyle,
  DisciplineType,
  Exercise,
  HangboardSet,
  LoggedCardio,
  LoggedHang,
  LoggedSet,
  PersonalRecord,
  PlannedWorkout,
  PRType,
  TagMeta,
  TemplateCategory,
  TemplateExercise,
  WorkoutSession,
  WorkoutTemplate,
} from '@/types'
import { toDateKey } from '@/lib/date'

// Wrap every DB op so failures surface with a descriptive message instead of a
// bare Dexie error. Helpers stay UI-agnostic — callers show the toast.
async function run<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    throw new Error(`[db] ${label} failed: ${(err as Error).message}`, { cause: err })
  }
}

// A pre-A36 backup may lack `category`; derive it on import so imported exercises
// aren't filtered out of pickers/progress (distance → cardio, else strength).
function withCategory(e: Exercise): Exercise {
  return (e as { category?: string }).category
    ? e
    : { ...e, category: e.trackingType === 'distance' ? 'cardio' : 'strength' }
}

// A94/F46 — a pre-v8 backup's templates carry the legacy single `type` and no
// `categories`. The Dexie v8 upgrade only runs on a version bump, never on import,
// so normalise here with the SAME content derivation as the migration, using the
// (imported + local) exercise categories. Idempotent: templates that already have
// categories pass through unchanged.
function withCategories(exCat: Map<string, string>) {
  return (t: WorkoutTemplate): WorkoutTemplate => {
    if (Array.isArray(t.categories) && t.categories.length > 0) return t
    const legacy = (t as { type?: string }).type
    let cats: TemplateCategory[]
    if (legacy === 'cardio') {
      cats = ['cardio']
    } else {
      const s = new Set<TemplateCategory>()
      for (const ex of t.exercises ?? []) {
        const c = exCat.get(ex.exerciseId)
        if (c === 'hangboard') s.add('climbing')
        else if (c === 'strength' || c === 'cardio' || c === 'climbing' || c === 'rehab') s.add(c)
      }
      if ((t.hangboardSets?.length ?? 0) > 0) s.add('climbing')
      cats = s.size > 0 ? [...s] : legacy === 'climbing' ? ['climbing'] : ['strength']
    }
    const rest = { ...t }
    delete (rest as { type?: string }).type
    return { ...rest, categories: cats }
  }
}

// A pre-F30 backup may store the board venue as 'home'; normalise it to 'board'
// on import so it matches the renamed discriminator.
function withBoardVenue(s: WorkoutSession): WorkoutSession {
  return (s as { climbingVenue?: string }).climbingVenue === 'home'
    ? { ...s, climbingVenue: 'board' }
    : s
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
    const tags = normalizeTags(e.tags)
    await db.exercises.put({ ...e, tags, id, createdAt: Date.now() })
    await ensureTags(tags)
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
    const normalized = updates.tags ? { ...updates, tags: normalizeTags(updates.tags) } : updates
    await db.transaction('rw', [db.exercises, db.templates], async () => {
      await db.exercises.update(id, normalized)
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
    // Register any new tags AFTER the exercises/templates transaction (the tags
    // table is not in that transaction's scope).
    if (normalized.tags) await ensureTags(normalized.tags)
  })
}

export async function deleteExercise(id: string): Promise<void> {
  return run('deleteExercise', () => db.exercises.delete(id))
}

// ---------------------------------------------------------------------------
// Tags (A35) — per-tag colour + default-selection metadata
// ---------------------------------------------------------------------------

// All tag metadata, in creation order (which drives palette cycling + display).
export async function getAllTags(): Promise<TagMeta[]> {
  return run('getAllTags', async () => {
    const list = await db.tags.toArray()
    return list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  })
}

// Registers metadata for any tag names not yet stored, assigning each the next
// palette colour in creation order. Idempotent — existing tags are left as-is.
export async function ensureTags(names: string[]): Promise<void> {
  return run('ensureTags', async () => {
    const norm = normalizeTags(names)
    if (norm.length === 0) return
    await db.transaction('rw', db.tags, async () => {
      const all = await db.tags.toArray()
      const existing = new Set(all.map((t) => t.name))
      const missing = norm.filter((n) => !existing.has(n))
      if (missing.length === 0) return
      let next = all.reduce((m, t) => Math.max(m, t.order + 1), 0)
      const toAdd: TagMeta[] = missing.map((name) => ({
        name,
        colour: paletteColourForOrder(next),
        order: next++,
      }))
      await db.tags.bulkAdd(toAdd)
    })
  })
}

// Backfills metadata for every tag currently used on an exercise or template, so
// tags that predate this feature (seed/import) show up in the manager with a
// palette colour. Called once at startup after seeding.
export async function syncAllTagMeta(): Promise<void> {
  return run('syncAllTagMeta', async () => {
    const [exercises, templates] = await Promise.all([
      db.exercises.toArray(),
      db.templates.toArray(),
    ])
    const used = new Set<string>()
    for (const e of exercises) for (const t of e.tags) used.add(t)
    for (const t of templates) for (const tag of t.tags) used.add(tag)
    await ensureTags([...used].sort())
  })
}

export async function setTagColour(name: string, colour: string): Promise<void> {
  return run('setTagColour', async () => {
    await db.tags.update(name, { colour })
  })
}

export async function setTagDefault(name: string, isDefault: boolean): Promise<void> {
  return run('setTagDefault', async () => {
    await db.tags.update(name, { isDefault })
  })
}

// Tag names pre-applied to new exercises / templates, in display order.
export async function getDefaultTags(): Promise<string[]> {
  return run('getDefaultTags', async () => {
    const list = await db.tags.filter((t) => t.isDefault === true).toArray()
    return list.sort((a, b) => a.order - b.order).map((t) => t.name)
  })
}

// Renames a tag everywhere: its metadata, and the denormalised tag strings on
// every exercise and template. If the new name already exists, the two merge
// (the target's colour/default win) and the old metadata row is dropped.
export async function renameTag(oldName: string, newName: string): Promise<void> {
  return run('renameTag', async () => {
    const from = oldName.trim().toLowerCase()
    const to = normalizeTags([newName])[0]
    if (!to || from === to) return
    await db.transaction('rw', [db.exercises, db.templates, db.tags], async () => {
      const exercises = await db.exercises.toArray()
      for (const e of exercises) {
        if (e.tags.includes(from)) {
          await db.exercises.update(e.id, {
            tags: normalizeTags(e.tags.map((t) => (t === from ? to : t))),
          })
        }
      }
      const templates = await db.templates.toArray()
      for (const t of templates) {
        if (t.tags.includes(from)) {
          await db.templates.update(t.id, {
            tags: normalizeTags(t.tags.map((x) => (x === from ? to : x))),
          })
        }
      }
      const target = await db.tags.get(to)
      const source = await db.tags.get(from)
      if (!target && source) {
        // Fresh name — carry the metadata across by renaming the row's key.
        await db.tags.delete(from)
        await db.tags.put({ ...source, name: to })
      } else {
        // Target exists (merge) — just drop the old row.
        await db.tags.delete(from)
      }
    })
  })
}

// Removes a tag from every exercise and template, then deletes its metadata.
export async function deleteTag(name: string): Promise<void> {
  return run('deleteTag', async () => {
    const tag = name.trim().toLowerCase()
    await db.transaction('rw', [db.exercises, db.templates, db.tags], async () => {
      const exercises = await db.exercises.toArray()
      for (const e of exercises) {
        if (e.tags.includes(tag)) {
          await db.exercises.update(e.id, { tags: e.tags.filter((t) => t !== tag) })
        }
      }
      const templates = await db.templates.toArray()
      for (const t of templates) {
        if (t.tags.includes(tag)) {
          await db.templates.update(t.id, { tags: t.tags.filter((x) => x !== tag) })
        }
      }
      await db.tags.delete(tag)
    })
  })
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

// Most-recently-used first, then alphabetical; never-used sink to the bottom.
function sortTemplatesMru(list: WorkoutTemplate[]): WorkoutTemplate[] {
  return list.sort(
    (a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name),
  )
}

export async function getAllTemplates(): Promise<WorkoutTemplate[]> {
  return run('getAllTemplates', async () => sortTemplatesMru(await db.templates.toArray()))
}

// A94 — templates that span a given discipline. A template appears under EACH of
// its `categories` (a strength+rehab template shows in both the Strength and Rehab
// tabs), which is the single source of truth (F46) — no longer content-derived.
// Filtered in memory; the template count is small.
export async function getTemplatesInCategory(
  category: TemplateCategory,
): Promise<WorkoutTemplate[]> {
  return run('getTemplatesInCategory', async () => {
    const list = (await db.templates.toArray()).filter((t) =>
      templateCategories(t).includes(category),
    )
    return sortTemplatesMru(list)
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
    const tags = normalizeTags(t.tags)
    const record: WorkoutTemplate = {
      id,
      name: t.name,
      categories: templateCategories(t),
      tags,
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
    await ensureTags(tags)
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

// Touches only lastActiveAt (A48). Called on a ~10s interval while a session
// screen is mounted so resume detection can tell a live session from an orphaned
// unfinished record.
export async function updateSessionHeartbeat(id: string): Promise<void> {
  return run('updateSessionHeartbeat', async () => {
    await db.sessions.update(id, { lastActiveAt: Date.now() })
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

// Rename a session's display title (A68). Live queries pick this up, so History
// and Recents update without a reload.
export async function renameSession(id: string, name: string): Promise<void> {
  return run('renameSession', async () => {
    const n = name.trim()
    if (n) await db.sessions.update(id, { templateName: n, titleRenamed: true })
  })
}

// A96 — edit a historic climbing session's location name. Writes to the field
// matching the session's venue (gym/crag/board), mirroring the active-session
// setLocation semantics: board keeps '' so its flavour stays detectable, gym/crag
// clear to undefined when blank. Live queries update History/Recents/progress.
export async function updateClimbingSessionLocation(id: string, location: string): Promise<void> {
  return run('updateClimbingSessionLocation', async () => {
    const s = await db.sessions.get(id)
    if (!s) return
    const venue =
      normalizeVenue(s.climbingVenue) ??
      (s.board !== undefined ? 'board' : s.crag !== undefined ? 'crag' : s.gym !== undefined ? 'gym' : undefined)
    if (!venue) return
    const n = location.trim()
    if (venue === 'board') await db.sessions.update(id, { board: n })
    else if (venue === 'gym') await db.sessions.update(id, { gym: n || undefined })
    else await db.sessions.update(id, { crag: n || undefined })
  })
}

export async function endSession(id: string): Promise<void> {
  return run('endSession', async () => {
    await db.sessions.update(id, { endedAt: Date.now() })
    // Best-effort: link a planned workout scheduled for this session's day and
    // template. Never blocks finishing — a failure here is swallowed.
    try {
      const session = await db.sessions.get(id)
      if (session?.templateId) {
        const dateKey = toDateKey(session.startedAt)
        const match = await db.plannedWorkouts
          .where('plannedDate')
          .equals(dateKey)
          .filter((p) => p.templateId === session.templateId && !p.completedSessionId)
          .first()
        if (match) await db.plannedWorkouts.update(match.id, { completedSessionId: id })
      }
    } catch {
      /* best-effort linking */
    }
  })
}

// Reopen a completed session as active again (F23): clear endedAt, roll the gap
// since it finished into pausedDuration (so the resumed clock counts only real
// workout time, not the time away), and touch lastActiveAt so the A34 resume
// banner treats it like any in-progress session. Logged sets/routes/cardio/hangs
// are untouched. No-op if the session is missing or already active.
export async function reopenSession(id: string): Promise<void> {
  return run('reopenSession', async () => {
    await db.transaction('rw', db.sessions, async () => {
      const s = await db.sessions.get(id)
      if (!s || s.endedAt == null) return
      const gap = Math.max(0, Date.now() - s.endedAt)
      s.pausedDuration = (s.pausedDuration ?? 0) + gap
      s.lastActiveAt = Date.now()
      delete s.endedAt // read-modify-put so the property is truly removed
      await db.sessions.put(s)
    })
  })
}

// One-time migration of legacy wallAngle → climbCharacter (they map 1:1), then
// clears wallAngle on every route (A45). Idempotent via a meta flag; run at
// startup after seeding.
export async function migrateWallAngles(): Promise<void> {
  return run('migrateWallAngles', async () => {
    if ((await db.meta.get('wallAngleMigrated'))?.value) return
    await db.routes.toCollection().modify((r) => {
      if (r.wallAngle && r.climbCharacter == null) r.climbCharacter = r.wallAngle
      delete r.wallAngle
    })
    await db.meta.put({ key: 'wallAngleMigrated', value: true })
  })
}

// One-time migration of the board venue discriminator 'home' → 'board' (F30).
// Idempotent via a meta flag; run at startup after seeding.
export async function migrateHomeVenueToBoard(): Promise<void> {
  return run('migrateHomeVenueToBoard', async () => {
    if ((await db.meta.get('homeVenueBoardMigrated'))?.value) return
    await db.sessions.toCollection().modify((s) => {
      const v = s as { climbingVenue?: string }
      if (v.climbingVenue === 'home') v.climbingVenue = 'board'
    })
    await db.meta.put({ key: 'homeVenueBoardMigrated', value: true })
  })
}

// ---------------------------------------------------------------------------
// Planned workouts (calendar)
// ---------------------------------------------------------------------------

export async function getPlannedWorkoutsForRange(
  from: string,
  to: string,
): Promise<PlannedWorkout[]> {
  return run('getPlannedWorkoutsForRange', async () => {
    const list = await db.plannedWorkouts
      .where('plannedDate')
      .between(from, to, true, true)
      .toArray()
    // Chronological, then by time-of-day (untimed last).
    return list.sort(
      (a, b) =>
        a.plannedDate.localeCompare(b.plannedDate) ||
        (a.plannedTimeOfDay ?? 1440) - (b.plannedTimeOfDay ?? 1440),
    )
  })
}

export async function addPlannedWorkout(
  p: Omit<PlannedWorkout, 'id' | 'createdAt'>,
): Promise<string> {
  return run('addPlannedWorkout', async () => {
    const id = generateId()
    await db.plannedWorkouts.put({ ...p, id, createdAt: Date.now() })
    return id
  })
}

export async function updatePlannedWorkout(
  id: string,
  updates: Partial<PlannedWorkout>,
): Promise<void> {
  return run('updatePlannedWorkout', async () => {
    await db.plannedWorkouts.update(id, updates)
  })
}

export async function deletePlannedWorkout(id: string): Promise<void> {
  return run('deletePlannedWorkout', () => db.plannedWorkouts.delete(id))
}

export async function linkPlanToSession(plannedId: string, sessionId: string): Promise<void> {
  return run('linkPlanToSession', async () => {
    await db.plannedWorkouts.update(plannedId, { completedSessionId: sessionId })
  })
}

// Reconstruct a workout "plan" from a past session's logged data.
function planExercisesFromSets(sets: LoggedSet[]): TemplateExercise[] {
  const order: string[] = []
  const groups = new Map<string, LoggedSet[]>()
  for (const s of [...sets].sort((a, b) => a.loggedAt - b.loggedAt)) {
    if (!groups.has(s.exerciseId)) {
      groups.set(s.exerciseId, [])
      order.push(s.exerciseId)
    }
    groups.get(s.exerciseId)!.push(s)
  }
  return order.map((exId, i) => {
    const g = groups.get(exId)!
    const first = g[0]
    // Preserve a timed exercise's duration so the rebuilt template stays timed
    // (rather than collapsing to an untimed reps row with no target).
    const timed = first.durationSeconds != null
    return {
      exerciseId: exId,
      exerciseName: first.exerciseName,
      order: i,
      defaultSets: g.length,
      defaultReps: timed ? undefined : (first.targetReps ?? first.actualReps),
      defaultDuration: timed ? first.durationSeconds : undefined,
      defaultRestSeconds: first.restTakenSeconds ?? 90,
    }
  })
}

function planHangsFromHangs(hangs: LoggedHang[]): HangboardSet[] {
  const key = (h: LoggedHang) =>
    `${h.gripType}|${h.edgeDepthMm}|${h.targetDurationSeconds}|${h.weightKg}`
  const order: string[] = []
  const groups = new Map<string, LoggedHang[]>()
  for (const h of [...hangs].sort((a, b) => a.loggedAt - b.loggedAt)) {
    const k = key(h)
    if (!groups.has(k)) {
      groups.set(k, [])
      order.push(k)
    }
    groups.get(k)!.push(h)
  }
  return order.map((k, i) => {
    const first = groups.get(k)![0]
    return {
      id: generateId(),
      gripType: first.gripType,
      hangType: first.hangType ?? 'sub_max',
      edgeDepthMm: first.edgeDepthMm,
      durationSeconds: first.targetDurationSeconds,
      weightKg: first.weightKg,
      sets: groups.get(k)!.length,
      restSeconds: first.restTakenSeconds ?? 60,
      abrahangReps: first.abrahangReps,
      order: i,
    }
  })
}

// Starts a fresh session pre-loaded from a past session (its plan is snapshotted
// onto the new session). Does not modify the source or any template.
export async function repeatSession(sourceId: string): Promise<string> {
  return run('repeatSession', async () => {
    const src = await db.sessions.get(sourceId)
    if (!src) throw new Error('source session not found')
    const base: Omit<WorkoutSession, 'id'> = {
      type: src.type,
      templateName: src.templateName,
      startedAt: Date.now(),
      modifiedFromTemplate: false,
    }
    if (src.type === 'strength') {
      base.plannedExercises = planExercisesFromSets(await getSetsForSession(sourceId))
    } else if (src.type === 'cardio') {
      const c = await getCardioForSession(sourceId)
      if (c) {
        base.plannedActivity = c.activityType
        if (c.intervals?.length) {
          base.plannedIntervals = [
            {
              repeat: 1,
              steps: c.intervals.map((iv) => ({
                label: iv.label,
                durationSeconds: iv.durationSeconds,
              })),
            },
          ]
        }
      }
    } else {
      const pe = planExercisesFromSets(await getSetsForSession(sourceId))
      const ph = planHangsFromHangs(await getHangsForSession(sourceId))
      if (pe.length) base.plannedExercises = pe
      if (ph.length) base.plannedHangs = ph
    }
    const id = generateId()
    await db.sessions.put({ ...base, id })
    return id
  })
}

// A template name not already taken; on collision appends " 2", " 3", … (A61).
async function uniqueTemplateName(base: string): Promise<string> {
  const trimmed = base.trim() || 'Workout'
  const taken = new Set((await db.templates.toArray()).map((t) => t.name))
  if (!taken.has(trimmed)) return trimmed
  let n = 2
  while (taken.has(`${trimmed} ${n}`)) n++
  return `${trimmed} ${n}`
}

// Creates a brand-new template from a completed session's logged data (A61):
// exercises/sets/reps/rest for strength & climbing, hangs for hangboard,
// activity + intervals for cardio. The source session is never modified. Returns
// the new template id. Route-only climbing sessions have no reusable structure,
// so callers don't offer this for them.
export async function createTemplateFromSession(
  sourceId: string,
  name: string,
  tags: string[],
): Promise<string> {
  return run('createTemplateFromSession', async () => {
    const src = await db.sessions.get(sourceId)
    if (!src) throw new Error('source session not found')
    const templateName = await uniqueTemplateName(name || src.templateName)
    const base: Omit<WorkoutTemplate, 'id' | 'createdAt'> = {
      name: templateName,
      categories: [], // A94 — derived from the reconstructed content below
      tags,
      exercises: [],
    }
    if (src.type === 'strength' || src.type === 'mixed') {
      // A66 — a mixed template keeps its exercise list; each exercise's own
      // tracking type drives the row variant when the template is started.
      base.exercises = planExercisesFromSets(await getSetsForSession(sourceId))
      // A73 — a training (mixed) session may also log hangs (hangboard exercises);
      // preserve them so the saved template rebuilds the hang rows too.
      if (src.type === 'mixed') {
        const ph = planHangsFromHangs(await getHangsForSession(sourceId))
        if (ph.length) base.hangboardSets = ph
      }
    } else if (src.type === 'cardio') {
      const c = await getCardioForSession(sourceId)
      base.cardioActivity = c?.activityType ?? 'other'
      if (c?.distanceKm != null) base.targetDistanceKm = c.distanceKm
      if (c?.durationSeconds) base.targetDurationSeconds = c.durationSeconds
      if (c?.intervals?.length) {
        base.intervals = [
          {
            repeat: 1,
            steps: c.intervals.map((iv) => ({
              label: iv.label,
              durationSeconds: iv.durationSeconds,
            })),
          },
        ]
      }
    } else {
      // Climbing workout / hangboard: reconstruct both blocks; kind follows content.
      const pe = planExercisesFromSets(await getSetsForSession(sourceId))
      const ph = planHangsFromHangs(await getHangsForSession(sourceId))
      base.exercises = pe
      base.hangboardSets = ph.length ? ph : undefined
      base.climbingKind = pe.length > 0 ? 'workout' : 'hangboard'
    }
    // A94 — categories from the reconstructed content. Cardio/climbing sessions
    // carry no exercise rows, so they map from the session discipline directly.
    base.categories =
      src.type === 'cardio'
        ? ['cardio']
        : src.type === 'climbing'
          ? ['climbing']
          : await deriveTemplateCategories(
              base.exercises.map((e) => e.exerciseId),
              (base.hangboardSets?.length ?? 0) > 0,
            )
    return upsertTemplate(base)
  })
}

// The distinct disciplines covered by a set of exercises (+ any hangboard sets,
// which read as climbing per A92). Never empty — falls back to strength.
async function deriveTemplateCategories(
  exerciseIds: string[],
  hasHangs: boolean,
): Promise<TemplateCategory[]> {
  const cats = new Set<TemplateCategory>()
  if (exerciseIds.length > 0) {
    const exs = await db.exercises.bulkGet(exerciseIds)
    for (const e of exs) {
      const c = e?.category
      if (c === 'hangboard') cats.add('climbing')
      else if (c === 'strength' || c === 'cardio' || c === 'climbing' || c === 'rehab') cats.add(c)
    }
  }
  if (hasHangs) cats.add('climbing')
  return cats.size > 0 ? [...cats] : ['strength']
}

// Deletes a session and everything logged under it. Also un-links any planned
// workout that recorded this session as its completion, so the plan reverts to
// "still planned" instead of pointing at a now-deleted session (which would show
// as done on the calendar yet open nothing).
export async function deleteSession(id: string): Promise<void> {
  return run('deleteSession', async () => {
    await db.transaction(
      'rw',
      [db.sessions, db.sets, db.cardio, db.routes, db.hangs, db.prs, db.plannedWorkouts],
      async () => {
        await db.sessions.delete(id)
        await db.sets.where('sessionId').equals(id).delete()
        await db.cardio.where('sessionId').equals(id).delete()
        await db.routes.filter((r) => r.sessionId === id).delete()
        await db.hangs.where('sessionId').equals(id).delete()
        await db.prs.where('sessionId').equals(id).delete()
        await db.plannedWorkouts
          .where('completedSessionId')
          .equals(id)
          .modify({ completedSessionId: undefined })
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

// The most recently active session that was never finished (A34) — used to show
// the "unfinished workout" resume banner on Home. Ordered by lastActiveAt (the
// A48 heartbeat) with a startedAt fallback, so a genuinely in-progress session
// wins over an orphaned unfinished record a bug may have left behind.
export async function getUnfinishedSession(): Promise<WorkoutSession | undefined> {
  return run('getUnfinishedSession', async () => {
    const unfinished = (await db.sessions.toArray()).filter((s) => s.endedAt == null)
    if (unfinished.length === 0) return undefined
    return unfinished.sort(
      (a, b) => (b.lastActiveAt ?? b.startedAt) - (a.lastActiveAt ?? a.startedAt),
    )[0]
  })
}

// Creates a live session from a template and marks the template used. Returns
// the new id + type so the caller can navigate. Shared by the template detail
// screen and the planner's "Start workout".
export async function startSessionFromTemplate(
  templateId: string,
): Promise<{ sessionId: string; type: DisciplineType } | null> {
  return run('startSessionFromTemplate', async () => {
    const t = await db.templates.get(templateId)
    if (!t) return null
    const sessionId = generateId()
    // A94 — the session gets a single DisciplineType derived from the template's
    // categories + content (sessions keep their own type, incl. 'mixed').
    const type = deriveSessionType(t)
    await db.sessions.put({
      id: sessionId,
      templateId: t.id,
      templateName: t.name,
      type,
      startedAt: Date.now(),
      modifiedFromTemplate: false,
    })
    await db.templates.update(t.id, { lastUsedAt: Date.now() })
    return { sessionId, type }
  })
}

// Starts a fresh, template-less session pre-loaded with a single exercise (A59).
// The exercise's default sets/reps or duration/rest come from the same defaults
// the "Add exercise" flow uses (3 sets · 10 reps or 30s · 90s rest). Returns the
// new session id; the caller navigates to the strength session screen. Distance
// (cardio) exercises aren't set-based, so callers should not offer this for them.
export async function startSessionFromExercise(exercise: Exercise): Promise<string> {
  return run('startSessionFromExercise', async () => {
    // A98 — seed the single planned row from the exercise's saved defaults.
    const planned: TemplateExercise = templateExerciseFromExercise(exercise, 0)
    const id = generateId()
    await db.sessions.put({
      id,
      templateName: exercise.name,
      type: 'strength',
      startedAt: Date.now(),
      modifiedFromTemplate: false,
      plannedExercises: [planned],
    })
    return id
  })
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

// Distinct exercise ids that have at least one logged set (F17) — the Progress
// strength picker uses this to hide exercises that have never been logged.
export async function getExerciseIdsWithSets(): Promise<string[]> {
  return run('getExerciseIdsWithSets', async () => {
    const keys = (await db.sets
      .orderBy('[exerciseId+loggedAt]')
      .keys()) as unknown as [string, number][]
    return [...new Set(keys.map((k) => k[0]))]
  })
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
    // Most recent non-skipped set, for pre-filling the next set's inputs (F22):
    // weight, additional weight, and reps. Not gated on weightKg, so bodyweight
    // and additional-load moves (pull-up "BW +10") pre-fill too.
    for (let i = sets.length - 1; i >= 0; i--) {
      if (!sets[i].skipped) return sets[i]
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

export async function getAllHangs(): Promise<LoggedHang[]> {
  return run('getAllHangs', () => db.hangs.toArray())
}

// Classify a batch of sessions by their logged content, so cards can show the
// right subtype emoji (route style / hangboard / climbing workout / cardio
// activity). Loads only the tables relevant to the sessions passed in.
export async function describeSessions(
  sessions: WorkoutSession[],
): Promise<Record<string, SessionKind>> {
  return run('describeSessions', async () => {
    const out: Record<string, SessionKind> = {}
    const climbing = sessions.filter((s) => s.type === 'climbing')
    const cardio = sessions.filter((s) => s.type === 'cardio')
    const mixed = sessions.filter((s) => s.type === 'mixed')

    if (cardio.length) {
      const ids = cardio.map((s) => s.id)
      const logs = await db.cardio.where('sessionId').anyOf(ids).toArray()
      const activityBy = new Map<string, CardioActivityType>()
      for (const c of logs) if (!activityBy.has(c.sessionId)) activityBy.set(c.sessionId, c.activityType)
      for (const s of cardio) {
        out[s.id] = deriveSessionKind(s, { cardioActivity: activityBy.get(s.id) })
      }
    }

    if (climbing.length) {
      const ids = climbing.map((s) => s.id)
      // hangs/sets have a standalone sessionId index; routes only a compound one,
      // so fetch those per session (indexed range scans, not a full-table scan).
      const [hangs, sets] = await Promise.all([
        db.hangs.where('sessionId').anyOf(ids).toArray(),
        db.sets.where('sessionId').anyOf(ids).toArray(),
      ])
      const hasHang = new Set(hangs.map((h) => h.sessionId))
      const hasSet = new Set(sets.map((x) => x.sessionId))
      const routeLists = await Promise.all(climbing.map((s) => getRoutesForSession(s.id)))
      climbing.forEach((s, i) => {
        out[s.id] = deriveSessionKind(s, {
          routes: routeLists[i],
          hasHang: hasHang.has(s.id),
          hasSet: hasSet.has(s.id),
        })
      })
    }

    // A73: mixed (training) sessions may contain hangs — a hang-only one reads as
    // a Hangboard session, so load their hang/set presence too.
    if (mixed.length) {
      const ids = mixed.map((s) => s.id)
      const [hangs, sets] = await Promise.all([
        db.hangs.where('sessionId').anyOf(ids).toArray(),
        db.sets.where('sessionId').anyOf(ids).toArray(),
      ])
      const hasHang = new Set(hangs.map((h) => h.sessionId))
      const hasSet = new Set(sets.map((x) => x.sessionId))
      for (const s of mixed) {
        out[s.id] = deriveSessionKind(s, { hasHang: hasHang.has(s.id), hasSet: hasSet.has(s.id) })
      }
    }

    return out
  })
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
    plannedWorkouts?: PlannedWorkout[]
    tags?: TagMeta[]
  }
}

export async function exportAllData(): Promise<string> {
  return run('exportAllData', async () => {
    const [exercises, templates, sessions, sets, cardio, routes, hangs, prs, plannedWorkouts, tags] =
      await Promise.all([
        db.exercises.toArray(),
        db.templates.toArray(),
        db.sessions.toArray(),
        db.sets.toArray(),
        db.cardio.toArray(),
        db.routes.toArray(),
        db.hangs.toArray(),
        db.prs.toArray(),
        db.plannedWorkouts.toArray(),
        db.tags.toArray(),
      ])
    const bundle: ExportBundle = {
      version: 1,
      exportedAt: Date.now(),
      data: {
        exercises,
        templates,
        sessions,
        sets,
        cardio,
        routes,
        hangs,
        prs,
        plannedWorkouts,
        tags,
      },
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
      [
        db.exercises,
        db.templates,
        db.sessions,
        db.sets,
        db.cardio,
        db.routes,
        db.hangs,
        db.prs,
        db.plannedWorkouts,
        db.tags,
      ],
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
          db.plannedWorkouts.clear(),
          db.tags.clear(),
        ])
        const importExs = (d.exercises ?? []).map(withCategory)
        const importExCat = new Map(importExs.map((e) => [e.id, e.category ?? 'strength']))
        if (importExs.length) await db.exercises.bulkAdd(importExs)
        if (d.templates?.length)
          await db.templates.bulkAdd(d.templates.map(withCategories(importExCat)))
        if (d.sessions?.length) await db.sessions.bulkAdd(d.sessions.map(withBoardVenue))
        if (d.sets?.length) await db.sets.bulkAdd(d.sets)
        if (d.cardio?.length) await db.cardio.bulkAdd(d.cardio)
        if (d.routes?.length) await db.routes.bulkAdd(d.routes)
        if (d.hangs?.length) await db.hangs.bulkAdd(d.hangs)
        if (d.prs?.length) await db.prs.bulkAdd(d.prs)
        if (d.plannedWorkouts?.length) await db.plannedWorkouts.bulkAdd(d.plannedWorkouts)
        if (d.tags?.length) await db.tags.bulkAdd(d.tags)
      },
    )
  })
}

// Activity → PR label, mirroring CardioSessionScreen's ACTIVITY_LABELS so a
// merged cardio PR keys identically to a live-logged one.
const CARDIO_PR_LABEL: Record<CardioActivityType, string> = {
  run: 'Run',
  ride: 'Ride',
  row: 'Row',
  other: 'Cardio',
}

// Re-derives PRs from records added by a merge, so the prs table stays consistent
// with the freshly-inserted data. Mirrors the live session logic across every PR
// type the app actually produces: strength weight (bodyweight-loadable moves
// compare their added load), climbing grade, hangboard weight + duration, and
// cardio distance + pace. ('reps' PRs are never produced anywhere in the app, so
// they are intentionally not re-derived.)
async function redetectPRs(
  newSets: LoggedSet[],
  newRoutes: ClimbingRoute[],
  newHangs: LoggedHang[],
  newCardio: LoggedCardio[],
): Promise<void> {
  // Exercises whose load lives in additionalWeightKg (pull-up, dip, …).
  const loadable = new Set(
    (await db.exercises.toArray()).filter((e) => e.supportsAdditionalWeight).map((e) => e.id),
  )
  for (const s of newSets) {
    if (s.skipped) continue
    if (!repsMet(s.targetReps, s.actualReps)) continue
    // Same weight-PR rule as the live logging path (loadable → added load alone).
    const value = weightPrValue(loadable.has(s.exerciseId), s)
    if (value == null) continue
    await checkAndSavePR({
      exerciseId: s.exerciseId,
      exerciseName: s.exerciseName,
      prType: 'weight',
      value,
      unit: 'kg',
      sessionId: s.sessionId,
      achievedAt: s.loggedAt,
    })
  }
  for (const r of newRoutes) {
    if (!isCleanTick(r.tick)) continue
    if (r.style === 'bouldering' && r.vGrade) {
      await checkAndSavePR({
        exerciseName: STYLE_LABELS.bouldering,
        climbingStyle: 'bouldering',
        prType: 'grade',
        value: vGradeIndex(r.vGrade),
        unit: 'vgrade',
        sessionId: r.sessionId,
        achievedAt: r.loggedAt,
      })
    } else if (r.style !== 'bouldering' && r.ewbanksGrade != null) {
      await checkAndSavePR({
        exerciseName: STYLE_LABELS[r.style],
        climbingStyle: r.style,
        prType: 'grade',
        value: r.ewbanksGrade,
        unit: 'ewbanks',
        sessionId: r.sessionId,
        achievedAt: r.loggedAt,
      })
    }
  }
  // Hangboard PRs are keyed per grip: heaviest added load and longest hang.
  for (const h of newHangs) {
    if (h.skipped) continue
    if (h.weightKg > 0) {
      await checkAndSavePR({
        exerciseName: h.gripType,
        prType: 'weight',
        value: h.weightKg,
        unit: 'kg',
        sessionId: h.sessionId,
        achievedAt: h.loggedAt,
      })
    }
    if (h.targetDurationSeconds > 0) {
      await checkAndSavePR({
        exerciseName: h.gripType,
        prType: 'duration',
        value: h.targetDurationSeconds,
        unit: 's',
        sessionId: h.sessionId,
        achievedAt: h.loggedAt,
      })
    }
  }
  for (const c of newCardio) {
    const label = CARDIO_PR_LABEL[c.activityType]
    if (c.distanceKm != null && c.distanceKm > 0) {
      await checkAndSavePR({
        exerciseName: label,
        prType: 'distance',
        value: c.distanceKm,
        unit: 'km',
        sessionId: c.sessionId,
        achievedAt: c.loggedAt,
      })
    }
    if (c.avgPaceSecondsPerKm != null && c.avgPaceSecondsPerKm > 0) {
      await checkAndSavePR({
        exerciseName: label,
        prType: 'pace',
        value: c.avgPaceSecondsPerKm,
        unit: 's/km',
        sessionId: c.sessionId,
        achievedAt: c.loggedAt,
      })
    }
  }
}

// Merges a backup into the existing DB: records whose id already exists are
// skipped (existing data wins); new ids are inserted. PR detection is re-run
// across newly inserted sets, routes, hangs and cardio so the prs table stays
// consistent.
export async function mergeData(json: string): Promise<{ inserted: number; skipped: number }> {
  return run('mergeData', async () => {
    const parsed = JSON.parse(json) as Partial<ExportBundle>
    const d = parsed.data
    if (!d || typeof d !== 'object') {
      throw new Error('unrecognised backup file (missing "data")')
    }

    let inserted = 0
    let skipped = 0
    const newSets: LoggedSet[] = []
    const newRoutes: ClimbingRoute[] = []
    const newHangs: LoggedHang[] = []
    const newCardio: LoggedCardio[] = []

    await db.transaction(
      'rw',
      [
        db.exercises,
        db.templates,
        db.sessions,
        db.sets,
        db.cardio,
        db.routes,
        db.hangs,
        db.prs,
        db.plannedWorkouts,
        db.tags,
      ],
      async () => {
        async function mergeInto<T extends { id: string }>(
          table: Dexie.Table<T, string>,
          records: T[] | undefined,
          onInsert?: (rec: T) => void,
        ) {
          if (!records?.length) return
          const existingIds = new Set(await table.toCollection().primaryKeys())
          const toAdd = records.filter((r) => {
            if (existingIds.has(r.id)) {
              skipped++
              return false
            }
            return true
          })
          if (toAdd.length) {
            await table.bulkAdd(toAdd)
            inserted += toAdd.length
            if (onInsert) toAdd.forEach(onInsert)
          }
        }

        await mergeInto(db.exercises, d.exercises?.map(withCategory))
        // Build the exercise-category map from the post-merge exercises table (local
        // + just-added), so imported legacy templates derive categories correctly.
        const mergeExCat = new Map(
          (await db.exercises.toArray()).map((e) => [e.id, e.category ?? 'strength']),
        )
        await mergeInto(db.templates, d.templates?.map(withCategories(mergeExCat)))
        await mergeInto(db.sessions, d.sessions?.map(withBoardVenue))
        await mergeInto(db.sets, d.sets, (s) => newSets.push(s))
        await mergeInto(db.cardio, d.cardio, (c) => newCardio.push(c))
        await mergeInto(db.routes, d.routes, (r) => newRoutes.push(r))
        await mergeInto(db.hangs, d.hangs, (h) => newHangs.push(h))
        await mergeInto(db.prs, d.prs)
        await mergeInto(db.plannedWorkouts, d.plannedWorkouts)

        // Tags are keyed by name, not id — merge separately (existing names win).
        if (d.tags?.length) {
          const existingNames = new Set(await db.tags.toCollection().primaryKeys())
          const toAdd = d.tags.filter((t) => !existingNames.has(t.name))
          if (toAdd.length) {
            await db.tags.bulkAdd(toAdd)
            inserted += toAdd.length
          }
          skipped += d.tags.length - toAdd.length
        }
      },
    )

    await redetectPRs(newSets, newRoutes, newHangs, newCardio)
    return { inserted, skipped }
  })
}

// Permanently wipes every table. The seed provenance lives in `meta`, so
// clearing it (plus the db_seeded flag) means the built-in library is
// re-seeded on the next app launch.
export async function clearAllData(): Promise<void> {
  return run('clearAllData', async () => {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear()
    })
    try {
      localStorage.removeItem('db_seeded')
    } catch {
      /* ignore */
    }
    clearAllActivePhases() // F48 — no session left to resume
  })
}
