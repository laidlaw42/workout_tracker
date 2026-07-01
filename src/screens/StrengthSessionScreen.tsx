import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { SlidersHorizontal } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useRestTimer } from '@/hooks/useRestTimer'
import {
  addSet,
  checkAndSavePR,
  deleteSession,
  endSession,
  getLastSetForExercise,
  getSessionById,
  getSetsForSession,
  getTemplate,
  updateSession,
  upsertTemplate,
} from '@/db/helpers'
import { generateId } from '@/lib/id'
import { SessionHeader } from '@/components/SessionHeader'
import { ExerciseCard, type LoggedSetInput, type WorkExercise } from '@/components/ExerciseCard'
import { RestTimer } from '@/components/RestTimer'
import { ModifySheet } from '@/components/ModifySheet'
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
  const loggedSets = useLiveQuery(() => getSetsForSession(id), [id]) ?? []

  const [work, setWork] = useState<WorkExercise[]>([])
  const [inited, setInited] = useState(false)
  const [modified, setModified] = useState(false)
  const [modifyOpen, setModifyOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState<'swap' | 'add'>('swap')
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)

  const timer = useSessionTimer(session?.startedAt ?? Date.now())
  const rest = useRestTimer()

  // Build the working list once, from the linked template or (for a repeat
  // session) the plan snapshotted onto the session.
  useEffect(() => {
    if (session && template !== undefined && !inited) {
      const plan = template?.exercises ?? session.plannedExercises ?? []
      setWork(
        [...plan]
          .sort((a, b) => a.order - b.order)
          .map((e) => ({
            uid: generateId(),
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            targetSets: e.defaultSets,
            targetReps: e.defaultReps,
            restSeconds: e.defaultRestSeconds,
            skipped: false,
          })),
      )
      setInited(true)
    }
  }, [session, template, inited])

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

  // Rest-timer completion: haptic (no-op on iOS) + auto-dismiss.
  const firedRef = useRef(false)
  useEffect(() => {
    if (rest.isRunning && rest.remaining === 0) {
      if (!firedRef.current) {
        firedRef.current = true
        navigator.vibrate?.([200, 100, 200])
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
        skipped: false,
        swappedFrom: ex.swappedFrom,
        loggedAt: Date.now(),
      })
      const repsMet = ex.targetReps == null || (data.actualReps ?? 0) >= ex.targetReps
      if (repsMet && data.weightKg != null) {
        await checkAndSavePR({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          prType: 'weight',
          value: data.weightKg,
          unit: 'kg',
          sessionId: id,
          achievedAt: Date.now(),
        })
      }
      rest.start(ex.restSeconds)
    } catch {
      toast.error('Could not log set')
    }
  }

  function addSetToCurrent() {
    if (!currentEx) return
    setWork((w) => w.map((e) => (e.uid === currentEx.uid ? { ...e, targetSets: e.targetSets + 1 } : e)))
    markModified()
    setModifyOpen(false)
  }

  function skipCurrent() {
    if (!currentEx) return
    setWork((w) => w.map((e) => (e.uid === currentEx.uid ? { ...e, skipped: true } : e)))
    rest.skip()
    markModified()
    setModifyOpen(false)
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

  function addNewExercises(exs: Exercise[]) {
    setWork((w) => [
      ...w,
      ...exs.map((ex) => ({
        uid: generateId(),
        exerciseId: ex.id,
        exerciseName: ex.name,
        targetSets: 3,
        // No target reps for a mid-session add — the reps field starts blank
        // rather than pre-filling a template/default value.
        targetReps: undefined,
        restSeconds: 90,
        skipped: false,
      })),
    ])
    markModified()
    setPickerOpen(false)
  }

  function onPickerSelect(exs: Exercise[]) {
    if (pickerMode === 'add') addNewExercises(exs)
    else if (exs[0]) swapCurrent(exs[0])
  }

  function move(uid: string, dir: -1 | 1) {
    setWork((w) => {
      const from = w.findIndex((e) => e.uid === uid)
      const to = from + dir
      if (from < 0 || to < 0 || to >= w.length) return w
      const next = [...w]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
    markModified()
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

  const remainingItems = work
    .filter((ex) => !isComplete(ex) || ex.uid === currentEx?.uid)
    .map((ex) => ({ uid: ex.uid, name: ex.exerciseName, isCurrent: ex.uid === currentEx?.uid }))

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

      <div className="space-y-3 p-4">
        {work.map((ex) => (
          <ExerciseCard
            key={ex.uid}
            exercise={ex}
            loggedSets={loggedFor(ex)}
            isCurrent={ex.uid === currentEx?.uid}
            prefillWeight={ex.uid === currentEx?.uid ? prefill?.weightKg : undefined}
            onLog={(data) => handleLog(ex, data)}
          />
        ))}

        {allDone && (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-center">
            <p className="font-medium text-green-300">All sets logged</p>
            <p className="text-sm text-muted-foreground">Tap Finish to see your summary.</p>
          </div>
        )}
      </div>

      {/* Modify FAB — lifted above the rest bar when it's showing. */}
      <button
        type="button"
        onClick={() => setModifyOpen(true)}
        className={`fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all ${
          rest.isRunning ? 'bottom-28' : 'bottom-6'
        }`}
        aria-label="Modify workout"
      >
        <SlidersHorizontal className="size-6" />
      </button>

      {rest.isRunning && (
        <RestTimer remaining={rest.remaining} duration={rest.duration} onSkip={rest.skip} />
      )}

      <ModifySheet
        open={modifyOpen}
        onOpenChange={setModifyOpen}
        currentName={currentEx?.exerciseName}
        remaining={remainingItems}
        onAddSet={addSetToCurrent}
        onSkip={skipCurrent}
        onSwap={() => {
          setModifyOpen(false)
          setPickerMode('swap')
          setPickerOpen(true)
        }}
        onAddExercise={() => {
          setModifyOpen(false)
          setPickerMode('add')
          setPickerOpen(true)
        }}
        onMove={move}
      />

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple={pickerMode === 'add'}
        onSelect={onPickerSelect}
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
            <AlertDialogTitle>Cancel this workout?</AlertDialogTitle>
            <AlertDialogDescription>All progress will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep workout</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Discard workout</AlertDialogAction>
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
