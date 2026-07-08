import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useRestTimer } from '@/hooks/useRestTimer'
import { useCountdownTimer } from '@/hooks/useCountdownTimer'
import { useCountdownBeeps } from '@/hooks/useCountdownBeeps'
import { usePrecountBeeps } from '@/hooks/usePrecountBeeps'
import { getAutoAdvance, getPrecountSeconds } from '@/lib/prefs'
import { addSet, checkAndSavePR } from '@/db/helpers'
import { repsMet, weightPrValue } from '@/lib/pr'
import {
  clearActivePhase,
  loadActivePhase,
  saveActivePhase,
  RESUME_GRACE_MS,
} from '@/lib/activePhase'
import type { LoggedSetInput, WorkExercise } from '@/components/ExerciseCard'
import type { Exercise } from '@/types'

export interface TimedSetEngineParams {
  /** The session id (keys the persisted F48 phase and the logged records). */
  sessionId: string
  /** Whether the session clock is paused — freezes all three timers. */
  paused: boolean
  /** Lift any session pause when logging/starting activity (F19). */
  resume: () => void
  /** The exercise queue (drives auto-advance + F48 resume "current" lookup). */
  work: WorkExercise[]
  /** exerciseId → Exercise, for the PR loadable flag and the timed check. */
  exById: Map<string, Exercise>
  /** Count of sets already logged for this exercise → next setNumber. */
  loggedCountFor: (ex: WorkExercise) => number
  isComplete: (ex: WorkExercise) => boolean
  /** True once the working list + logged sets have loaded, so the once-only F48
   *  resume picks the correct "current" item. Flipping it false→true fires it. */
  ready: boolean
}

export interface TimedSetEngine {
  rest: ReturnType<typeof useRestTimer>
  countdown: ReturnType<typeof useCountdownTimer>
  precount: ReturnType<typeof useCountdownTimer>
  logSet: (ex: WorkExercise, data: LoggedSetInput) => Promise<void>
  startTimedSet: (ex: WorkExercise, input?: LoggedSetInput) => void
  /** Cancel the active pre-count/countdown/rest and drop the persisted phase —
   *  call when the current item is skipped. */
  cancelTimers: () => void
  /** Drop the persisted F48 phase (finish/cancel/manual rest-skip). */
  clearPhase: () => void
}

// CA1 — the timed-set engine shared by StrengthSessionScreen and
// ClimbingSessionScreen: the three timers (rest / exercise-countdown /
// pre-count), the log→rest→auto-advance orchestration for both exercises and
// hangboard hangs, and the F48 persist/resume that lets a running phase survive a
// reload. The screens own their working lists and views; they hand the engine the
// current state and render with what it returns.
export function useTimedSetEngine(params: TimedSetEngineParams): TimedSetEngine {
  const {
    sessionId: id,
    paused,
    resume,
    work,
    exById,
    loggedCountFor,
    isComplete,
    ready,
  } = params

  // Pausing the session freezes the rest and countdown timers too (they resume
  // from where they left off when the session resumes).
  const rest = useRestTimer(paused)
  const countdown = useCountdownTimer(paused)
  const precount = useCountdownTimer(paused)
  useCountdownBeeps(countdown.remaining, countdown.isRunning && !paused)
  usePrecountBeeps(precount.remaining, precount.isRunning && !paused)

  // F48 — persist the running timed phase so it survives a reload/remount (see
  // src/lib/activePhase.ts). `ref` is stable across a reload: an exercise's
  // exerciseId (its uid is regenerated each mount) or a hang's hangSetId.
  const persistPhase = (
    phase: 'precount' | 'countdown' | 'rest',
    kind: 'exercise' | 'hang',
    ref: string,
    seconds: number,
  ) => saveActivePhase(id, { kind, ref, phase, endsAt: Date.now() + seconds * 1000 })
  const clearPhase = () => clearActivePhase(id)
  const resumedRef = useRef(false)

  // Rest-timer completion: haptic (no-op on iOS) + auto-dismiss. For a timed
  // set, reaching 0 auto-starts the next set's countdown (A8, if enabled).
  const firedRef = useRef(false)
  // The timed item (exercise or hangboard hang) the current rest follows, so its
  // countdown can auto-start when the rest expires (A8). Null when the rest
  // follows an untimed set.
  const restTimedRef = useRef<{ kind: 'exercise' | 'hang'; uid: string } | null>(null)
  const autoAdvanceRef = useRef<() => boolean>(() => false)
  useEffect(() => {
    if (rest.isRunning && rest.remaining === 0) {
      if (!firedRef.current) {
        firedRef.current = true
        navigator.vibrate?.([200, 100, 200])
        if (autoAdvanceRef.current()) return // began the next timed set instead of dismissing
        // No next timed set — the flow is done; drop the persisted phase so a
        // later reload doesn't try to resume a finished rest.
        clearPhase()
        const t = setTimeout(() => rest.skip(), 2000)
        return () => clearTimeout(t)
      }
    } else {
      firedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest.isRunning, rest.remaining, rest.skip])

  async function logSet(ex: WorkExercise, data: LoggedSetInput) {
    resume() // logging activity lifts any pause (F19)
    const setNumber = loggedCountFor(ex) + 1
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
        distanceKm: data.distanceKm, // cardio exercise in a mixed session (A66)
        edgeDepthMm: data.edgeDepthMm, // F51 — hangboard edge
        skipped: false,
        swappedFrom: ex.swappedFrom,
        loggedAt: Date.now(),
      })
      const meta = exById.get(ex.exerciseId)
      if (repsMet(ex.targetReps, data.actualReps)) {
        const prValue = weightPrValue(meta?.isBodyweight, data)
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
      // F51 — a duration exercise (hang, plank, …) records a longest-hold PR. Keyed
      // by exerciseName like every PR, so a grip's longest hang carries over.
      if (meta?.trackingType === 'duration' && (data.durationSeconds ?? 0) > 0) {
        await checkAndSavePR({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          prType: 'duration',
          value: data.durationSeconds!,
          unit: 's',
          sessionId: id,
          achievedAt: Date.now(),
        })
      }
      // Only a genuinely timed exercise (a hold) auto-advances its countdown —
      // a cardio bout has a durationSeconds but no countdown (A66).
      restTimedRef.current =
        exById.get(ex.exerciseId)?.trackingType === 'duration'
          ? { kind: 'exercise', uid: ex.uid }
          : null
      rest.start(ex.restSeconds)
      // Persist the rest so a reload mid-rest resumes it and still auto-advances
      // (F48). Only for timed exercises — a reps rest has nothing to advance to.
      if (restTimedRef.current) persistPhase('rest', 'exercise', ex.exerciseId, ex.restSeconds)
      else clearPhase()
    } catch {
      toast.error('Could not log set')
    }
  }

  // The load/edge to log for a timed set that carries no user input (auto-advance /
  // F48 resume): fall back to the exercise's planned values.
  const plannedTimedInput = (ex: WorkExercise): LoggedSetInput => {
    const bodyweight = exById.get(ex.exerciseId)?.isBodyweight
    return {
      weightKg: !bodyweight && ex.weight != null ? ex.weight : undefined,
      additionalWeightKg: bodyweight && ex.weight != null && ex.weight !== 0 ? ex.weight : undefined,
      edgeDepthMm: ex.edgeDepthMm,
    }
  }

  // Timed exercises: run the countdown, then log the set (which starts rest).
  // Starting a set dismisses any running rest timer immediately (A8). `input`
  // carries the load/edge the user set on the row; auto-advance and F48 resume
  // pass none and fall back to the planned values (F51).
  function startTimedSet(ex: WorkExercise, input?: LoggedSetInput) {
    if (ex.durationSeconds == null) return
    resume() // starting a timed set lifts any pause (F19)
    rest.skip()
    const data: LoggedSetInput = {
      ...(input ?? plannedTimedInput(ex)),
      durationSeconds: ex.durationSeconds,
    }
    const secs = ex.durationSeconds
    const run = () => {
      persistPhase('countdown', 'exercise', ex.exerciseId, secs)
      countdown.start(ex.uid, secs, () => logSet(ex, data))
    }
    // Optional "Get ready" pre-count before the exercise countdown (A30).
    const pre = getPrecountSeconds()
    if (pre > 0) {
      persistPhase('precount', 'exercise', ex.exerciseId, pre)
      precount.start(ex.uid, pre, run)
    } else run()
  }

  // Re-assigned every render so the rest-expiry effect starts the next timed set
  // using the latest state. Returns true when it began one.
  autoAdvanceRef.current = () => {
    if (!getAutoAdvance()) return false
    const info = restTimedRef.current
    restTimedRef.current = null
    if (!info) return false
    const ex = work.find((e) => e.uid === info.uid)
    if (ex && ex.durationSeconds != null && !isComplete(ex)) {
      startTimedSet(ex)
      return true
    }
    return false
  }

  // Skipping the active item stops its running rest and any in-flight
  // countdown/pre-count — otherwise a timed exercise's countdown would run to
  // zero and log a phantom set for the now-skipped item.
  function cancelTimers() {
    rest.skip()
    countdown.cancel()
    precount.cancel()
    clearPhase()
  }

  // F48 — resume a timed phase that a reload/remount interrupted. Runs once, when
  // `ready` flips true (working lists + logged sets/hangs loaded, so the
  // "current" item is correct). A running rest resumes with its remaining time and
  // still auto-advances; a rest that fully elapsed while away, or an interrupted
  // pre-count/countdown, (re)starts the current set. A stale phase (session
  // re-opened much later) is dropped rather than auto-firing a countdown.
  useEffect(() => {
    if (resumedRef.current) return
    if (!ready) return
    resumedRef.current = true
    const ap = loadActivePhase(id)
    if (!ap) return
    // Don't fight a timer that's already live (e.g. StrictMode double-mount).
    if (precount.isRunning || countdown.isRunning || rest.isRunning) return
    if (Date.now() - ap.endsAt >= RESUME_GRACE_MS) {
      clearPhase()
      return
    }
    const ex = work.find((e) => !isComplete(e)) // the current exercise
    if (!ex || ex.exerciseId !== ap.ref || ex.durationSeconds == null) {
      clearPhase()
      return
    }
    const remaining = Math.round((ap.endsAt - Date.now()) / 1000)
    if (ap.phase === 'rest' && remaining > 1) {
      restTimedRef.current = { kind: 'exercise', uid: ex.uid }
      persistPhase('rest', 'exercise', ex.exerciseId, remaining)
      rest.start(remaining)
    } else {
      startTimedSet(ex) // elapsed rest, or interrupted pre-count/countdown → (re)start the set
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return {
    rest,
    countdown,
    precount,
    logSet,
    startTimedSet,
    cancelTimers,
    clearPhase,
  }
}
