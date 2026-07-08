import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useLiveQuery } from '@/hooks/useDb'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useWakeLock } from '@/hooks/useWakeLock'
import { useTimedSetEngine } from '@/hooks/useTimedSetEngine'
import { getKeepAwake } from '@/lib/prefs'
import {
  deleteSession,
  endSession,
  getAllExercises,
  getLastSetForExercise,
  getSessionById,
  getSetsForSession,
  getTemplate,
  updateSession,
  upsertTemplate,
} from '@/db/helpers'
import { Dumbbell, Plus } from 'lucide-react'
import { generateId } from '@/lib/id'
import { templateCategories } from '@/lib/templateCategories'
import { resolveExerciseDefaults } from '@/lib/exerciseDefaults'
import { patchById, removeById, reorderKeepingComplete, updateById } from '@/lib/workQueue'
import { SessionHeader } from '@/components/SessionHeader'
import { ExerciseCard, type WorkExercise } from '@/components/ExerciseCard'
import { SortableList } from '@/components/SortableList'
import { RestTimer } from '@/components/RestTimer'
import { ExercisePicker } from '@/components/ExercisePicker'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Exercise, LoggedSet, WorkoutTemplate } from '@/types'

// uid accessor for the shared work-queue transforms (exercises key by uid).
const exUid = (e: WorkExercise) => e.uid

export default function StrengthSessionScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const session = useLiveQuery(() => getSessionById(id).then((s) => s ?? null), [id])
  // Keyed to the session's templateId (F38): Dexie's useLiveQuery holds the
  // previous result across a key change, so a bare null can't distinguish a
  // still-resolving query from a genuinely deleted template. `forId` only equals
  // the current templateId once the query has settled for it.
  const templateQuery = useLiveQuery(
    () =>
      session?.templateId
        ? getTemplate(session.templateId).then((t) => ({ forId: session.templateId!, template: t ?? null }))
        : { forId: null as string | null, template: null as WorkoutTemplate | null },
    [session?.templateId],
  )
  const templateSettled =
    templateQuery !== undefined && templateQuery.forId === (session?.templateId ?? null)
  // The resolved template once settled: the record, or `null` if it was deleted
  // (F38). `undefined` means still loading — callers wait on `templateSettled`.
  const template = templateSettled ? templateQuery!.template : undefined
  const loggedSetsRaw = useLiveQuery(() => getSetsForSession(id), [id])
  const loggedSets = loggedSetsRaw ?? []
  const exercises = useLiveQuery(() => getAllExercises(), []) ?? []
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const [work, setWork] = useState<WorkExercise[]>([])
  const [inited, setInited] = useState(false)
  const [modified, setModified] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null)
  const [confirmRemoveLastUid, setConfirmRemoveLastUid] = useState<string | null>(null)
  const [addPickerOpen, setAddPickerOpen] = useState(false)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)

  const timer = useSessionTimer(id, session?.startedAt ?? Date.now(), session?.pausedDuration ?? 0)
  useWakeLock(getKeepAwake())

  // Build the working list once, from the linked template or (for a repeat
  // session) the plan snapshotted onto the session.
  useEffect(() => {
    if (inited || !session || loggedSetsRaw === undefined) return
    // When the session references a template, wait for the keyed query to settle
    // before seeding — otherwise a transient stale value would build an empty
    // list and the `inited` guard would stop it recovering. Once settled a
    // deleted template resolves to null (F38) and we fall back to the session's
    // own plan / logged sets, so the session still opens.
    if (session.templateId && !templateSettled) return
    const plan = template?.exercises ?? session.plannedExercises ?? []
    const seeded: WorkExercise[] = [...plan]
      .sort((a, b) => a.order - b.order)
      .map((e) => ({
        uid: generateId(),
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        targetSets: e.defaultSets,
        targetReps: e.defaultReps,
        durationSeconds: e.defaultDuration,
        weight: e.defaultWeight, // A98 — template's default weight pre-fills the set row
        distanceKm: e.defaultDistanceKm,
        restSeconds: e.defaultRestSeconds,
        edgeDepthMm: e.defaultEdgeDepthMm, // F51 — hangboard edge
        skipped: false,
      }))
    // Resuming an unfinished session (A34): re-attach exercises that were added
    // mid-session — they have logged sets but aren't in the plan. Restored as
    // complete (their true target is unknown); "Add set" continues them.
    const planned = new Set(seeded.map((e) => e.exerciseId))
    const extras = new Map<string, LoggedSet[]>()
    for (const s of loggedSetsRaw) {
      if (planned.has(s.exerciseId)) continue
      const arr = extras.get(s.exerciseId) ?? []
      arr.push(s)
      extras.set(s.exerciseId, arr)
    }
    for (const [exId, sets] of extras) {
      const last = sets[sets.length - 1]
      seeded.push({
        uid: generateId(),
        exerciseId: exId,
        exerciseName: last.exerciseName,
        targetSets: sets.length,
        targetReps: last.targetReps,
        durationSeconds: last.durationSeconds ?? undefined,
        restSeconds: 90,
        skipped: false,
      })
    }
    setWork(seeded)
    setInited(true)
  }, [session, template, templateSettled, inited, loggedSetsRaw])

  const setsByExercise = useMemo(() => {
    const map = new Map<string, LoggedSet[]>()
    for (const s of loggedSets) {
      const arr = map.get(s.exerciseId) ?? []
      arr.push(s)
      map.set(s.exerciseId, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.setNumber - b.setNumber)
    return map
  }, [loggedSets])

  const loggedFor = (ex: WorkExercise) => setsByExercise.get(ex.exerciseId) ?? []
  const isComplete = (ex: WorkExercise) => ex.skipped || loggedFor(ex).length >= ex.targetSets

  const currentIndex = work.findIndex((ex) => !isComplete(ex))
  const currentEx = currentIndex >= 0 ? work[currentIndex] : undefined
  const allDone = work.length > 0 && currentIndex === -1

  const prefillRaw = useLiveQuery(
    () => (currentEx ? getLastSetForExercise(currentEx.exerciseId) : undefined),
    [currentEx?.exerciseId],
  )
  // useLiveQuery holds the previous exercise's value across an exercise change
  // until the new query resolves; ignore it unless it belongs to the current
  // exercise, so a new set never seeds from the wrong exercise (F22).
  const prefill = prefillRaw?.exerciseId === currentEx?.exerciseId ? prefillRaw : undefined

  function markModified() {
    if (!modified) {
      setModified(true)
      void updateSession(id, { modifiedFromTemplate: true })
    }
  }

  // CA1 — the shared timed-set engine: three timers, log→rest→auto-advance, and the
  // F48 persist/resume. Ready once the working list + logged sets have loaded.
  const engine = useTimedSetEngine({
    sessionId: id,
    paused: timer.paused,
    resume: timer.resume,
    work,
    exById,
    loggedCountFor: (ex) => loggedFor(ex).length,
    isComplete,
    ready: inited && loggedSetsRaw !== undefined,
  })

  function addSetTo(uid: string) {
    setWork((w) => updateById(w, exUid, uid, (e) => ({ ...e, targetSets: e.targetSets + 1 })))
    markModified()
  }

  // Apply an inline edit (A31) to the remaining unlogged sets of one exercise.
  function editExercise(uid: string, updates: Partial<WorkExercise>) {
    setWork((w) => patchById(w, exUid, uid, updates))
    markModified()
  }

  // Remove one incomplete set. If it's the exercise's only set, confirm removing
  // the whole exercise. Logged sets are never affected (the button only shows on
  // the active, not-yet-logged set).
  function removeSet(uid: string) {
    const ex = work.find((e) => e.uid === uid)
    if (!ex) return
    if (ex.targetSets <= 1) {
      setConfirmRemoveLastUid(uid)
      return
    }
    setWork((w) => updateById(w, exUid, uid, (e) => ({ ...e, targetSets: e.targetSets - 1 })))
    markModified()
  }
  function doRemoveLast() {
    if (!confirmRemoveLastUid) return
    setWork((w) => removeById(w, exUid, confirmRemoveLastUid))
    markModified()
    setConfirmRemoveLastUid(null)
  }

  // Append picked exercises to the working queue (F51 — hangboard grips are
  // ordinary duration exercises, so no special-casing).
  function appendExercises(exs: Exercise[]) {
    if (!exs.length) return
    // A66/A73: a build-from-scratch strength session becomes 'mixed' the first
    // time a cardio, climbing or hangboard exercise joins it.
    if (
      session?.type === 'strength' &&
      exs.some(
        (e) => e.category === 'cardio' || e.category === 'climbing' || e.category === 'hangboard',
      )
    ) {
      void updateSession(id, { type: 'mixed' })
    }
    // A98 — seed each row from the exercise's saved defaults (falling back to the
    // standard 3 sets · 10 reps / 30s · 90s rest when none are set).
    setWork((w) => [
      ...w,
      ...exs.map((ex) => {
        const r = resolveExerciseDefaults(ex)
        return {
          uid: generateId(),
          exerciseId: ex.id,
          exerciseName: ex.name,
          targetSets: r.sets,
          targetReps: r.reps,
          durationSeconds: r.durationSeconds,
          weight: r.weightKg,
          distanceKm: r.distanceKm,
          restSeconds: r.restSeconds,
          edgeDepthMm: r.edgeDepthMm, // F51 — hangboard grip's default edge
          skipped: false,
        }
      }),
    ])
    markModified()
    setAddPickerOpen(false)
  }

  function skip(uid: string) {
    setWork((w) => patchById(w, exUid, uid, { skipped: true }))
    // Skipping the active item also stops its running rest and any in-flight
    // countdown/pre-count — otherwise a timed exercise's countdown would run to
    // zero and log a phantom set for the now-skipped exercise.
    if (uid === currentEx?.uid) engine.cancelTimers()
    markModified()
  }

  function swapCurrent(ex: Exercise) {
    if (!currentEx) return
    // A66 — swapping in a cardio/climbing exercise turns a strength session mixed,
    // mirroring appendExercises. Reset the targets to the new exercise's kind so
    // it renders in the right row variant.
    if (session?.type === 'strength' && (ex.category === 'cardio' || ex.category === 'climbing')) {
      void updateSession(id, { type: 'mixed' })
    }
    setWork((w) =>
      w.map((e) =>
        e.uid === currentEx.uid
          ? {
              ...e,
              exerciseId: ex.id,
              exerciseName: ex.name,
              swappedFrom: e.exerciseName,
              targetReps: ex.trackingType === 'reps' ? (e.targetReps ?? 10) : undefined,
              durationSeconds: ex.trackingType === 'duration' ? (e.durationSeconds ?? 30) : undefined,
            }
          : e,
      ),
    )
    markModified()
    setPickerOpen(false)
  }

  function reorderActive(activeUids: string[]) {
    setWork((w) => reorderKeepingComplete(w, exUid, isComplete, activeUids))
    markModified()
  }

  // Removes an exercise from the queue; logged sets stay in the DB.
  function doRemove() {
    if (!confirmRemoveUid) return
    setWork((w) => removeById(w, exUid, confirmRemoveUid))
    markModified()
    setConfirmRemoveUid(null)
  }

  async function endAndGo() {
    engine.clearPhase() // F48 — the session is ending; drop any persisted timed phase
    try {
      await endSession(id)
      navigate(`/session/${id}/summary`)
    } catch {
      toast.error('Could not finish workout')
    }
  }

  async function handleCancel() {
    engine.clearPhase()
    try {
      await deleteSession(id)
      navigate('/home')
    } catch {
      toast.error('Could not cancel workout')
    }
  }

  // If the workout diverged from its template, offer to persist the changes.
  function proceedFinish() {
    setConfirmFinish(false)
    if (modified && session?.templateId) setSaveTemplateOpen(true)
    else void endAndGo()
  }

  async function saveTemplateThenGo() {
    if (session?.templateId) {
      try {
        await upsertTemplate({
          id: session.templateId,
          name: session.templateName,
          // A94 — keep the template's own categories (a multi-discipline template
          // must not be written back as a single-discipline one).
          categories: template ? templateCategories(template) : ['strength'],
          tags: template?.tags ?? [],
          exercises: work
            .filter((e) => !e.skipped)
            .map((e, i) => {
              // Preserve a timed exercise's duration so saving back to the
              // template doesn't collapse it into an untimed reps row.
              const timed = e.durationSeconds != null
              return {
                exerciseId: e.exerciseId,
                exerciseName: e.exerciseName,
                order: i,
                defaultSets: e.targetSets,
                defaultReps: timed ? undefined : e.targetReps,
                defaultDuration: timed ? e.durationSeconds : undefined,
                defaultWeight: e.weight,
                defaultRestSeconds: e.restSeconds,
                // F51 — preserve the hangboard edge so a training template round-trips.
                defaultEdgeDepthMm: e.edgeDepthMm,
              }
            }),
          lastUsedAt: template?.lastUsedAt,
        })
      } catch {
        toast.error('Could not update template')
      }
    }
    setSaveTemplateOpen(false)
    void endAndGo()
  }

  if (session === null) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Session not found.</p>
        <Button className="mt-3" onClick={() => navigate('/home')}>
          Go home
        </Button>
      </div>
    )
  }

  const removeName = work.find((e) => e.uid === confirmRemoveUid)?.exerciseName

  // A66 — a build-from-scratch session (no template) can gain any exercise type,
  // so its add/swap pickers show every category grouped rather than strength+rehab.
  const buildYourOwn =
    session != null &&
    (session.type === 'mixed' || (session.type === 'strength' && !session.templateId))

  return (
    <div className="min-h-dvh pb-32">
      <SessionHeader
        title={session?.templateName ?? 'Workout'}
        elapsedSeconds={timer.elapsed}
        paused={timer.paused}
        onPause={timer.pause}
        onResume={timer.resume}
        onClose={() => navigate('/home')}
        onDelete={() => setConfirmCancel(true)}
        onFinish={() => (allDone ? proceedFinish() : setConfirmFinish(true))}
      />

      <div className="p-4">
        <SortableList
          items={work}
          getUid={(e) => e.uid}
          isComplete={isComplete}
          isDimmed={(e) => e.skipped}
          currentUid={currentEx?.uid}
          onReorder={reorderActive}
          onSkip={skip}
          onRemove={setConfirmRemoveUid}
          renderItem={(ex, isCurrent) => {
            // A66/F51 — dispatch each exercise to its row variant by tracking type
            // (cardio → duration+distance); all field visibility on the reps row is
            // driven by the exercise's own tracking config.
            const meta = exById.get(ex.exerciseId)
            const distanceMode = meta?.trackingType === 'distance'
            return (
              <ExerciseCard
                exercise={ex}
                loggedSets={loggedFor(ex)}
                isCurrent={isCurrent}
                prefill={isCurrent ? prefill : undefined}
                hasWeight={meta?.hasWeight}
                weightLabel={meta?.weightLabel}
                isBodyweight={meta?.isBodyweight}
                supportsNegativeLoad={meta?.supportsNegativeLoad}
                hasEdgeDepth={meta?.hasEdgeDepth}
                distanceMode={distanceMode}
                onLog={(d) => engine.logSet(ex, d)}
                onAddSet={() => addSetTo(ex.uid)}
                onRemoveSet={() => removeSet(ex.uid)}
                onSwap={isCurrent ? () => setPickerOpen(true) : undefined}
                onEdit={(u) => editExercise(ex.uid, u)}
                onStartCountdown={(input) => engine.startTimedSet(ex, input)}
                countdown={
                  isCurrent && engine.precount.activeUid === ex.uid
                    ? { remaining: engine.precount.remaining, duration: engine.precount.duration, precount: true }
                    : isCurrent && engine.countdown.activeUid === ex.uid
                      ? {
                          remaining: engine.countdown.remaining,
                          duration: engine.countdown.duration,
                        }
                      : null
                }
              />
            )
          }}
        />

        {inited && work.length === 0 ? (
          // A62 — a brand-new empty workout: the primary action is adding the
          // first exercise. Build the whole session from scratch here.
          <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
            <Dumbbell className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Add your first exercise to get started.</p>
            <Button size="lg" onClick={() => setAddPickerOpen(true)}>
              <Plus className="size-4" /> Add exercise
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="mt-3 w-full" onClick={() => setAddPickerOpen(true)}>
            <Plus className="size-4" /> Add exercise
          </Button>
        )}

        {allDone && (
          <div className="mt-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-center">
            <p className="font-medium text-green-300">All sets logged</p>
            <p className="text-sm text-muted-foreground">Tap Finish to see your summary.</p>
          </div>
        )}
      </div>

      {engine.rest.isRunning && (
        <RestTimer
          remaining={engine.rest.remaining}
          duration={engine.rest.duration}
          paused={timer.paused}
          onSkip={() => {
            engine.rest.skip()
            engine.clearPhase() // F48 — a manual skip ends the timed flow
          }}
        />
      )}

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        categories={buildYourOwn ? undefined : ['strength', 'rehab']}
        onSelect={(exs) => exs[0] && swapCurrent(exs[0])}
      />
      <ExercisePicker
        open={addPickerOpen}
        onOpenChange={setAddPickerOpen}
        multiple
        categories={buildYourOwn ? undefined : ['strength', 'rehab', 'hangboard']}
        onSelect={appendExercises}
      />

      <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End workout early?</AlertDialogTitle>
            <AlertDialogDescription>
              You still have sets left. You can finish now and review your summary.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction onClick={proceedFinish}>Finish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this workout?</AlertDialogTitle>
            <AlertDialogDescription>All progress will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep workout</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancel}>
              Discard workout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRemoveUid !== null} onOpenChange={(o) => !o && setConfirmRemoveUid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{removeName}” from this workout?</AlertDialogTitle>
            <AlertDialogDescription>Logged sets will be kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={doRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmRemoveLastUid !== null}
        onOpenChange={(o) => !o && setConfirmRemoveLastUid(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the last set?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the exercise from the workout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={doRemoveLast}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes to template?</AlertDialogTitle>
            <AlertDialogDescription>
              You modified this workout. Update “{session?.templateName}” to match?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => void endAndGo()}>No, keep it</AlertDialogCancel>
            <AlertDialogAction onClick={saveTemplateThenGo}>Save changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
