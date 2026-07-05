import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useLiveQuery } from '@/hooks/useDb'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useRestTimer } from '@/hooks/useRestTimer'
import { useCountdownTimer } from '@/hooks/useCountdownTimer'
import { useCountdownBeeps } from '@/hooks/useCountdownBeeps'
import { usePrecountBeeps } from '@/hooks/usePrecountBeeps'
import { useWakeLock } from '@/hooks/useWakeLock'
import { getAutoAdvance, getKeepAwake, getPrecountSeconds } from '@/lib/prefs'
import {
  addSet,
  checkAndSavePR,
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
import { Plus } from 'lucide-react'
import { generateId } from '@/lib/id'
import { SessionHeader } from '@/components/SessionHeader'
import { ExerciseCard, type LoggedSetInput, type WorkExercise } from '@/components/ExerciseCard'
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
import type { Exercise, LoggedSet } from '@/types'

export default function StrengthSessionScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const session = useLiveQuery(() => getSessionById(id).then((s) => s ?? null), [id])
  const template = useLiveQuery(
    () => (session?.templateId ? getTemplate(session.templateId).then((t) => t ?? null) : null),
    [session?.templateId],
  )
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
  const rest = useRestTimer()
  const countdown = useCountdownTimer()
  const precount = useCountdownTimer()
  useCountdownBeeps(countdown.remaining, countdown.isRunning)
  usePrecountBeeps(precount.remaining, precount.isRunning)
  useWakeLock(getKeepAwake())

  // Build the working list once, from the linked template or (for a repeat
  // session) the plan snapshotted onto the session.
  useEffect(() => {
    if (inited || !session || loggedSetsRaw === undefined) return
    // When the session references a template, wait for it to actually load
    // before seeding the working list. `template` is transiently null while the
    // templateId-keyed query re-subscribes; seeding then would build an empty
    // list and the `inited` guard would prevent it from ever recovering.
    if (session.templateId && !template) return
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
        restSeconds: e.defaultRestSeconds,
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
  }, [session, template, inited, loggedSetsRaw])

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

  const prefill = useLiveQuery(
    () => (currentEx ? getLastSetForExercise(currentEx.exerciseId) : undefined),
    [currentEx?.exerciseId],
  )

  // Rest-timer completion: haptic (no-op on iOS) + auto-dismiss. For a timed
  // set, reaching 0 auto-starts the next set's countdown (A8, if enabled).
  const firedRef = useRef(false)
  const restTimedRef = useRef<string | null>(null) // timed exercise uid the rest follows, else null
  const autoAdvanceRef = useRef<() => boolean>(() => false)
  useEffect(() => {
    if (rest.isRunning && rest.remaining === 0) {
      if (!firedRef.current) {
        firedRef.current = true
        navigator.vibrate?.([200, 100, 200])
        if (autoAdvanceRef.current()) return // began the next timed set instead of dismissing
        const t = setTimeout(() => rest.skip(), 2000)
        return () => clearTimeout(t)
      }
    } else {
      firedRef.current = false
    }
  }, [rest.isRunning, rest.remaining, rest.skip])

  function markModified() {
    if (!modified) {
      setModified(true)
      void updateSession(id, { modifiedFromTemplate: true })
    }
  }

  async function handleLog(ex: WorkExercise, data: LoggedSetInput) {
    timer.resume() // logging activity lifts any pause (F19)
    const setNumber = loggedFor(ex).length + 1
    try {
      await addSet({
        sessionId: id,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        setNumber,
        targetReps: ex.targetReps,
        actualReps: data.actualReps,
        weightKg: data.weightKg,
        additionalWeightKg: data.additionalWeightKg,
        durationSeconds: data.durationSeconds,
        skipped: false,
        swappedFrom: ex.swappedFrom,
        loggedAt: Date.now(),
      })
      const repsMet = ex.targetReps == null || (data.actualReps ?? 0) >= ex.targetReps
      if (repsMet) {
        // Bodyweight-loadable moves (pull-up, dip, …): bodyweight isn't tracked,
        // so the PR compares the added load alone. Everything else uses the bar
        // weight.
        const loadable = exById.get(ex.exerciseId)?.supportsAdditionalWeight
        const prValue = loadable
          ? data.additionalWeightKg != null && data.additionalWeightKg > 0
            ? data.additionalWeightKg
            : undefined
          : data.weightKg
        if (prValue != null) {
          await checkAndSavePR({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            prType: 'weight',
            value: prValue,
            unit: 'kg',
            sessionId: id,
            achievedAt: Date.now(),
          })
        }
      }
      restTimedRef.current = ex.durationSeconds != null ? ex.uid : null
      rest.start(ex.restSeconds)
    } catch {
      toast.error('Could not log set')
    }
  }

  // Timed exercises: run the countdown, then log the set (which starts rest).
  // Starting a set dismisses any running rest timer immediately (A8).
  function startTimedSet(ex: WorkExercise) {
    if (ex.durationSeconds == null) return
    timer.resume() // starting a timed set lifts any pause (F19)
    rest.skip()
    const run = () =>
      countdown.start(ex.uid, ex.durationSeconds!, () =>
        handleLog(ex, { durationSeconds: ex.durationSeconds }),
      )
    // Optional "Get ready" pre-count before the exercise countdown (A30).
    const pre = getPrecountSeconds()
    if (pre > 0) precount.start(ex.uid, pre, run)
    else run()
  }

  // Re-assigned every render so the rest-expiry effect starts the next timed set
  // using the latest state. Returns true when it began a countdown.
  autoAdvanceRef.current = () => {
    if (!getAutoAdvance()) return false
    const uid = restTimedRef.current
    restTimedRef.current = null
    if (!uid) return false
    const ex = work.find((e) => e.uid === uid)
    if (ex && ex.durationSeconds != null && !isComplete(ex)) {
      startTimedSet(ex)
      return true
    }
    return false
  }

  function addSetTo(uid: string) {
    setWork((w) => w.map((e) => (e.uid === uid ? { ...e, targetSets: e.targetSets + 1 } : e)))
    markModified()
  }

  // Apply an inline edit (A31) to the remaining unlogged sets of one exercise.
  function editExercise(uid: string, updates: Partial<WorkExercise>) {
    setWork((w) => w.map((e) => (e.uid === uid ? { ...e, ...updates } : e)))
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
    setWork((w) => w.map((e) => (e.uid === uid ? { ...e, targetSets: e.targetSets - 1 } : e)))
    markModified()
  }
  function doRemoveLast() {
    if (!confirmRemoveLastUid) return
    setWork((w) => w.filter((e) => e.uid !== confirmRemoveLastUid))
    markModified()
    setConfirmRemoveLastUid(null)
  }

  // Append picked exercises to the end of the queue as fresh, incomplete work.
  function appendExercises(exs: Exercise[]) {
    if (!exs.length) return
    setWork((w) => [
      ...w,
      ...exs.map((ex) => ({
        uid: generateId(),
        exerciseId: ex.id,
        exerciseName: ex.name,
        targetSets: 3,
        targetReps: ex.trackingType === 'duration' ? undefined : 10,
        durationSeconds: ex.trackingType === 'duration' ? 30 : undefined,
        restSeconds: 90,
        skipped: false,
      })),
    ])
    markModified()
    setAddPickerOpen(false)
  }

  function skip(uid: string) {
    setWork((w) => w.map((e) => (e.uid === uid ? { ...e, skipped: true } : e)))
    if (uid === currentEx?.uid) rest.skip()
    markModified()
  }

  function swapCurrent(ex: Exercise) {
    if (!currentEx) return
    setWork((w) =>
      w.map((e) =>
        e.uid === currentEx.uid
          ? { ...e, exerciseId: ex.id, exerciseName: ex.name, swappedFrom: e.exerciseName }
          : e,
      ),
    )
    markModified()
    setPickerOpen(false)
  }

  function reorderActive(activeUids: string[]) {
    setWork((w) => {
      const completed = w.filter((e) => isComplete(e))
      const byUid = new Map(w.map((e) => [e.uid, e]))
      const reordered = activeUids
        .map((u) => byUid.get(u))
        .filter((e): e is WorkExercise => e != null)
      return [...completed, ...reordered]
    })
    markModified()
  }

  // Removes an exercise from the queue; logged sets stay in the DB.
  function doRemove() {
    if (!confirmRemoveUid) return
    setWork((w) => w.filter((e) => e.uid !== confirmRemoveUid))
    markModified()
    setConfirmRemoveUid(null)
  }

  async function endAndGo() {
    try {
      await endSession(id)
      navigate(`/session/${id}/summary`)
    } catch {
      toast.error('Could not finish workout')
    }
  }

  async function handleCancel() {
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
          type: 'strength',
          tags: template?.tags ?? [],
          exercises: work
            .filter((e) => !e.skipped)
            .map((e, i) => ({
              exerciseId: e.exerciseId,
              exerciseName: e.exerciseName,
              order: i,
              defaultSets: e.targetSets,
              defaultReps: e.targetReps,
              defaultRestSeconds: e.restSeconds,
            })),
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

  return (
    <div className="min-h-dvh pb-32">
      <SessionHeader
        title={session?.templateName ?? 'Workout'}
        elapsedSeconds={timer.elapsed}
        paused={timer.paused}
        onPause={timer.pause}
        onResume={timer.resume}
        onCancel={() => setConfirmCancel(true)}
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
          renderItem={(ex, isCurrent) => (
            <ExerciseCard
              exercise={ex}
              loggedSets={loggedFor(ex)}
              isCurrent={isCurrent}
              prefill={isCurrent ? prefill : undefined}
              supportsAdditionalWeight={exById.get(ex.exerciseId)?.supportsAdditionalWeight}
              onLog={(d) => handleLog(ex, d)}
              onAddSet={() => addSetTo(ex.uid)}
              onRemoveSet={() => removeSet(ex.uid)}
              onSwap={isCurrent ? () => setPickerOpen(true) : undefined}
              onEdit={(u) => editExercise(ex.uid, u)}
              onStartCountdown={() => startTimedSet(ex)}
              countdown={
                isCurrent && precount.activeUid === ex.uid
                  ? { remaining: precount.remaining, duration: precount.duration, precount: true }
                  : isCurrent && countdown.activeUid === ex.uid
                    ? { remaining: countdown.remaining, duration: countdown.duration }
                    : null
              }
            />
          )}
        />

        <Button variant="outline" className="mt-3 w-full" onClick={() => setAddPickerOpen(true)}>
          <Plus className="size-4" /> Add exercise
        </Button>

        {allDone && (
          <div className="mt-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-center">
            <p className="font-medium text-green-300">All sets logged</p>
            <p className="text-sm text-muted-foreground">Tap Finish to see your summary.</p>
          </div>
        )}
      </div>

      {rest.isRunning && (
        <RestTimer remaining={rest.remaining} duration={rest.duration} onSkip={rest.skip} />
      )}

      <ExercisePicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(exs) => exs[0] && swapCurrent(exs[0])} />
      <ExercisePicker open={addPickerOpen} onOpenChange={setAddPickerOpen} multiple onSelect={appendExercises} />

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
            <AlertDialogTitle>Cancel this workout?</AlertDialogTitle>
            <AlertDialogDescription>All progress will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep workout</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Discard workout</AlertDialogAction>
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
