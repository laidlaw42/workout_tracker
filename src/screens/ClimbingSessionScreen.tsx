import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Mountain, Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useRestTimer } from '@/hooks/useRestTimer'
import { useCountdownTimer } from '@/hooks/useCountdownTimer'
import { useCountdownBeeps } from '@/hooks/useCountdownBeeps'
import { usePrecountBeeps } from '@/hooks/usePrecountBeeps'
import { useWakeLock } from '@/hooks/useWakeLock'
import {
  getAutoAdvance,
  getGymGradePreference,
  getGymGradeRanges,
  getKeepAwake,
  getPrecountSeconds,
  setGymGradePreference,
} from '@/lib/prefs'
import {
  addHang,
  addSet,
  checkAndSavePR,
  deleteRoute,
  deleteSession,
  endSession,
  getHangsForSession,
  getLastSetForExercise,
  getRoutesForSession,
  getSessionById,
  getSetsForSession,
  getTemplate,
  updateSession,
} from '@/db/helpers'
import { STYLE_LABELS, isCleanTick, vGradeIndex } from '@/lib/climbing'
import { SessionHeader } from '@/components/SessionHeader'
import { RouteCard } from '@/components/RouteCard'
import { LogRouteSheet } from '@/components/LogRouteSheet'
import { ExerciseCard, type LoggedSetInput, type WorkExercise } from '@/components/ExerciseCard'
import { HangCard } from '@/components/HangCard'
import { SortableList } from '@/components/SortableList'
import { RestTimer } from '@/components/RestTimer'
import { ExercisePicker } from '@/components/ExercisePicker'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { ClimbingRoute, ClimbingStyle, Exercise, HangboardSet, LoggedSet } from '@/types'

type WorkHang = HangboardSet & { skipped: boolean }

// Short per-style button labels (A24).
const STYLE_BTN_LABELS: Record<ClimbingStyle, string> = {
  bouldering: 'Boulder',
  top_rope: 'Top rope',
  lead: 'Lead',
}

export default function ClimbingSessionScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const session = useLiveQuery(() => getSessionById(id).then((s) => s ?? null), [id])
  const template = useLiveQuery(
    () => (session?.templateId ? getTemplate(session.templateId).then((t) => t ?? null) : null),
    [session?.templateId],
  )
  const routes = useLiveQuery(() => getRoutesForSession(id), [id]) ?? []
  const hangs = useLiveQuery(() => getHangsForSession(id), [id]) ?? []
  const loggedSetsRaw = useLiveQuery(() => getSetsForSession(id), [id])
  const loggedSets = loggedSetsRaw ?? []

  const [gym, setGym] = useState('')
  const [crag, setCrag] = useState('')
  const [board, setBoard] = useState('')
  const [inited, setInited] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ClimbingRoute | null>(null)
  const [newStyle, setNewStyle] = useState<ClimbingStyle>('bouldering')
  // Active grade system for gym routes — seeded from this gym's saved preference,
  // kept across route logs, and re-applied on remount/resume (F20).
  const [gradeSystem, setGradeSystem] = useState<'standard' | 'gym'>('standard')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmDeleteRouteId, setConfirmDeleteRouteId] = useState<string | null>(null)

  const clock = useSessionTimer(id, session?.startedAt ?? Date.now(), session?.pausedDuration ?? 0)
  const rest = useRestTimer()
  const countdown = useCountdownTimer()
  const precount = useCountdownTimer()
  useCountdownBeeps(countdown.remaining, countdown.isRunning)
  usePrecountBeeps(precount.remaining, precount.isRunning)
  useWakeLock(getKeepAwake())

  // Which venue field to show. Prefer the explicit discriminator; fall back to
  // field presence for sessions created before it existed.
  const venue: 'gym' | 'crag' | 'home' | undefined =
    session?.climbingVenue ??
    (session?.board !== undefined
      ? 'home'
      : session?.crag !== undefined
        ? 'crag'
        : session?.gym !== undefined
          ? 'gym'
          : undefined)
  const isBoard = venue === 'home'
  const gymName = gym.trim() || session?.gym || undefined

  // Rest-timer completion: haptic + auto-dismiss. For a timed set/hang, reaching
  // 0 auto-starts the next set's countdown (A8, if enabled).
  const firedRef = useRef(false)
  const restTimedRef = useRef<{ kind: 'exercise' | 'hang'; uid: string } | null>(null)
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

  useEffect(() => {
    if (session && !inited) {
      setGym(session.gym ?? '')
      setCrag(session.crag ?? '')
      setBoard(session.board ?? '')
      // Default a gym session to whichever grade system this gym was last logged
      // in (F20); non-gym sessions never show the toggle, so 'standard' is fine.
      setGradeSystem(getGymGradePreference(session.gym ?? '') ?? 'standard')
      setInited(true)
    }
  }, [session, inited])

  useEffect(() => {
    if (session && session.type !== 'climbing') navigate('/home', { replace: true })
  }, [session, navigate])

  // Plan comes from the linked template (workout kind) or a repeat snapshot.
  const planExercises =
    template?.climbingKind === 'workout' ? template.exercises : session?.plannedExercises
  const planHangs = template?.hangboardSets ?? session?.plannedHangs
  const basePlanExercises = useMemo<WorkExercise[]>(
    () =>
      [...(planExercises ?? [])]
        .sort((a, b) => a.order - b.order)
        .map((e) => ({
          uid: `${e.exerciseId}-${e.order}`,
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          targetSets: e.defaultSets,
          targetReps: e.defaultReps,
          durationSeconds: e.defaultDuration,
          restSeconds: e.defaultRestSeconds,
          skipped: false,
        })),
    [planExercises],
  )
  const baseHangs = useMemo<WorkHang[]>(
    () => [...(planHangs ?? [])].sort((a, b) => a.order - b.order).map((h) => ({ ...h, skipped: false })),
    [planHangs],
  )

  const [work, setWork] = useState<WorkExercise[]>([])
  const [workInited, setWorkInited] = useState(false)
  const [hangWork, setHangWork] = useState<WorkHang[]>([])
  const [hangWorkInited, setHangWorkInited] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [addPickerOpen, setAddPickerOpen] = useState(false)
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null)
  const [confirmRemoveLastUid, setConfirmRemoveLastUid] = useState<string | null>(null)
  const [confirmRemoveHangId, setConfirmRemoveHangId] = useState<string | null>(null)
  const [confirmRemoveLastHangId, setConfirmRemoveLastHangId] = useState<string | null>(null)

  useEffect(() => {
    if (!workInited && template !== undefined && basePlanExercises.length > 0 && loggedSetsRaw !== undefined) {
      // Resuming an unfinished session (A34): re-attach exercises that were
      // added mid-session (logged sets exist but aren't in the plan), restored
      // as complete — "Add set" continues them.
      const planned = new Set(basePlanExercises.map((e) => e.exerciseId))
      const extras = new Map<string, LoggedSet[]>()
      for (const s of loggedSetsRaw) {
        if (planned.has(s.exerciseId)) continue
        const arr = extras.get(s.exerciseId) ?? []
        arr.push(s)
        extras.set(s.exerciseId, arr)
      }
      const resumed: WorkExercise[] = [...extras.entries()].map(([exId, sets]) => {
        const last = sets[sets.length - 1]
        return {
          uid: `${exId}-resumed`,
          exerciseId: exId,
          exerciseName: last.exerciseName,
          targetSets: sets.length,
          targetReps: last.targetReps,
          durationSeconds: last.durationSeconds ?? undefined,
          restSeconds: 90,
          skipped: false,
        }
      })
      setWork([...basePlanExercises, ...resumed])
      setWorkInited(true)
    }
  }, [basePlanExercises, workInited, template, loggedSetsRaw])
  useEffect(() => {
    if (!hangWorkInited && template !== undefined && baseHangs.length > 0) {
      setHangWork(baseHangs)
      setHangWorkInited(true)
    }
  }, [baseHangs, hangWorkInited, template])

  const hasExercises = (planExercises?.length ?? 0) > 0
  const hasHangs = (planHangs?.length ?? 0) > 0
  const showExercises = hasExercises
  const showHangs = hasHangs
  // Routes for plain (no plan) or workout (has exercises); hangboard-only hides them.
  const showRoutes = !hasHangs || hasExercises

  // --- Exercise logging (climbing-workout kind) ---------------------------
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
  const loggedForEx = (ex: WorkExercise) => setsByExercise.get(ex.exerciseId) ?? []
  const isComplete = (ex: WorkExercise) => ex.skipped || loggedForEx(ex).length >= ex.targetSets
  const currentEx = work.find((ex) => !isComplete(ex))
  const prefill = useLiveQuery(
    () => (currentEx ? getLastSetForExercise(currentEx.exerciseId) : undefined),
    [currentEx?.exerciseId],
  )

  function addSetTo(uid: string) {
    setWork((w) => w.map((e) => (e.uid === uid ? { ...e, targetSets: e.targetSets + 1 } : e)))
  }
  // Inline edit (A31) — applies to the exercise's remaining unlogged sets.
  function editExercise(uid: string, updates: Partial<WorkExercise>) {
    setWork((w) => w.map((e) => (e.uid === uid ? { ...e, ...updates } : e)))
  }
  function skip(uid: string) {
    setWork((w) => w.map((e) => (e.uid === uid ? { ...e, skipped: true } : e)))
    if (uid === currentEx?.uid) {
      rest.skip()
      countdown.cancel()
    }
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
    setPickerOpen(false)
  }
  function reorderActive(activeUids: string[]) {
    setWork((w) => {
      const completed = w.filter((e) => isComplete(e))
      const byUid = new Map(w.map((e) => [e.uid, e]))
      const reordered = activeUids.map((u) => byUid.get(u)).filter((e): e is WorkExercise => e != null)
      return [...completed, ...reordered]
    })
  }
  function doRemoveExercise() {
    if (!confirmRemoveUid) return
    setWork((w) => w.filter((e) => e.uid !== confirmRemoveUid))
    setConfirmRemoveUid(null)
  }
  function removeSet(uid: string) {
    const ex = work.find((e) => e.uid === uid)
    if (!ex) return
    if (ex.targetSets <= 1) {
      setConfirmRemoveLastUid(uid)
      return
    }
    setWork((w) => w.map((e) => (e.uid === uid ? { ...e, targetSets: e.targetSets - 1 } : e)))
  }
  function doRemoveLast() {
    if (!confirmRemoveLastUid) return
    setWork((w) => w.filter((e) => e.uid !== confirmRemoveLastUid))
    setConfirmRemoveLastUid(null)
  }
  function appendExercises(exs: Exercise[]) {
    if (!exs.length) return
    const stamp = Date.now()
    setWork((w) => [
      ...w,
      ...exs.map((ex, i) => ({
        uid: `${ex.id}-add-${stamp}-${i}`,
        exerciseId: ex.id,
        exerciseName: ex.name,
        targetSets: 3,
        targetReps: ex.trackingType === 'duration' ? undefined : 10,
        durationSeconds: ex.trackingType === 'duration' ? 30 : undefined,
        restSeconds: 90,
        skipped: false,
      })),
    ])
    setAddPickerOpen(false)
  }

  async function logExerciseSet(ex: WorkExercise, data: LoggedSetInput) {
    clock.resume() // logging activity lifts any pause (F19)
    const setNumber = loggedForEx(ex).length + 1
    try {
      await addSet({
        sessionId: id,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        setNumber,
        targetReps: ex.targetReps,
        actualReps: data.actualReps,
        weightKg: data.weightKg,
        durationSeconds: data.durationSeconds,
        skipped: false,
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
      restTimedRef.current = ex.durationSeconds != null ? { kind: 'exercise', uid: ex.uid } : null
      rest.start(ex.restSeconds)
    } catch {
      toast.error('Could not log set')
    }
  }
  function startTimedSet(ex: WorkExercise) {
    if (ex.durationSeconds == null) return
    clock.resume() // starting a timed set lifts any pause (F19)
    rest.skip()
    const run = () =>
      countdown.start(ex.uid, ex.durationSeconds!, () =>
        logExerciseSet(ex, { durationSeconds: ex.durationSeconds }),
      )
    const pre = getPrecountSeconds()
    if (pre > 0) precount.start(ex.uid, pre, run)
    else run()
  }

  // --- Hang logging (hangboard) -------------------------------------------
  const loggedForHang = (hs: HangboardSet) =>
    hangs.filter((h) => h.hangSetId === hs.id).sort((a, b) => a.setNumber - b.setNumber)
  const completedFor = (hs: HangboardSet) => loggedForHang(hs).length
  const isCompleteHang = (h: WorkHang) => h.skipped || completedFor(h) >= h.sets
  const currentHang = hangWork.find((h) => !isCompleteHang(h))

  function addSetToHang(hid: string) {
    setHangWork((w) => w.map((h) => (h.id === hid ? { ...h, sets: h.sets + 1 } : h)))
  }
  // Inline edit (A31) — applies to the set's remaining unlogged hangs.
  function editHang(hid: string, updates: Partial<HangboardSet>) {
    setHangWork((w) => w.map((h) => (h.id === hid ? { ...h, ...updates } : h)))
  }
  function skipHang(hid: string) {
    setHangWork((w) => w.map((h) => (h.id === hid ? { ...h, skipped: true } : h)))
    if (hid === currentHang?.id) {
      rest.skip()
      countdown.cancel()
    }
  }
  function reorderHangs(activeIds: string[]) {
    setHangWork((w) => {
      const done = w.filter((h) => isCompleteHang(h))
      const byId = new Map(w.map((h) => [h.id, h]))
      const reordered = activeIds.map((x) => byId.get(x)).filter((h): h is WorkHang => h != null)
      return [...done, ...reordered]
    })
  }
  function doRemoveHang() {
    if (!confirmRemoveHangId) return
    setHangWork((w) => w.filter((h) => h.id !== confirmRemoveHangId))
    setConfirmRemoveHangId(null)
  }
  function removeHangSet(hid: string) {
    const h = hangWork.find((x) => x.id === hid)
    if (!h) return
    if (h.sets <= 1) {
      setConfirmRemoveLastHangId(hid)
      return
    }
    setHangWork((w) => w.map((x) => (x.id === hid ? { ...x, sets: x.sets - 1 } : x)))
  }
  function doRemoveLastHang() {
    if (!confirmRemoveLastHangId) return
    setHangWork((w) => w.filter((h) => h.id !== confirmRemoveLastHangId))
    setConfirmRemoveLastHangId(null)
  }

  async function logHang(hs: HangboardSet) {
    clock.resume() // logging activity lifts any pause (F19)
    try {
      await addHang({
        sessionId: id,
        hangSetId: hs.id,
        gripType: hs.gripType,
        edgeDepthMm: hs.edgeDepthMm,
        setNumber: completedFor(hs) + 1,
        targetDurationSeconds: hs.durationSeconds,
        actualDurationSeconds: hs.durationSeconds,
        weightKg: hs.weightKg,
        skipped: false,
        loggedAt: Date.now(),
      })
      // Hangboard PRs are keyed per grip type: heaviest added load and longest
      // hang. Assisted (negative) hangs don't count toward a weight PR.
      const now = Date.now()
      if (hs.weightKg > 0) {
        await checkAndSavePR({
          exerciseName: hs.gripType,
          prType: 'weight',
          value: hs.weightKg,
          unit: 'kg',
          sessionId: id,
          achievedAt: now,
        })
      }
      if (hs.durationSeconds > 0) {
        await checkAndSavePR({
          exerciseName: hs.gripType,
          prType: 'duration',
          value: hs.durationSeconds,
          unit: 's',
          sessionId: id,
          achievedAt: now,
        })
      }
      restTimedRef.current = { kind: 'hang', uid: hs.id }
      rest.start(hs.restSeconds)
    } catch {
      toast.error('Could not log hang')
    }
  }
  function startHangCountdown(hs: HangboardSet) {
    clock.resume() // starting a hang lifts any pause (F19)
    rest.skip()
    const run = () => countdown.start(hs.id, hs.durationSeconds, () => logHang(hs))
    const pre = getPrecountSeconds()
    if (pre > 0) precount.start(hs.id, pre, run)
    else run()
  }

  // Re-assigned every render so the rest-expiry effect starts the next timed
  // item using the latest state. Returns true when it began a countdown.
  autoAdvanceRef.current = () => {
    if (!getAutoAdvance()) return false
    const info = restTimedRef.current
    restTimedRef.current = null
    if (!info) return false
    if (info.kind === 'exercise') {
      const ex = work.find((e) => e.uid === info.uid)
      if (ex && ex.durationSeconds != null && !isComplete(ex)) {
        startTimedSet(ex)
        return true
      }
    } else {
      const h = hangWork.find((x) => x.id === info.uid)
      if (h && !isCompleteHang(h)) {
        startHangCountdown(h)
        return true
      }
    }
    return false
  }

  async function saveGradePRs() {
    const cleanRoutes = routes.filter((r) => isCleanTick(r.tick))
    const styles: ClimbingStyle[] = ['bouldering', 'top_rope', 'lead']
    for (const style of styles) {
      // Only standard-graded routes count toward grade PRs — gym-grade routes
      // are never conflated with V/Ewbanks scales.
      const inStyle = cleanRoutes.filter(
        (r) => r.style === style && (style === 'bouldering' ? r.vGrade != null : r.ewbanksGrade != null),
      )
      if (inStyle.length === 0) continue
      const value =
        style === 'bouldering'
          ? Math.max(...inStyle.map((r) => (r.vGrade ? vGradeIndex(r.vGrade) : -1)))
          : Math.max(...inStyle.map((r) => r.ewbanksGrade ?? 0))
      await checkAndSavePR({
        exerciseName: STYLE_LABELS[style],
        climbingStyle: style,
        prType: 'grade',
        value,
        unit: style === 'bouldering' ? 'vgrade' : 'ewbanks',
        sessionId: id,
        achievedAt: Date.now(),
      })
    }
  }

  async function finish() {
    try {
      await saveGradePRs()
      await endSession(id)
      navigate(`/session/${id}/summary`)
    } catch {
      toast.error('Could not finish session')
    }
  }
  async function handleCancel() {
    try {
      await deleteSession(id)
      navigate('/home')
    } catch {
      toast.error('Could not cancel session')
    }
  }
  async function doDeleteRoute() {
    if (!confirmDeleteRouteId) return
    try {
      await deleteRoute(confirmDeleteRouteId)
    } catch {
      toast.error('Could not delete route')
    }
    setConfirmDeleteRouteId(null)
  }

  function openNew(s: ClimbingStyle) {
    setNewStyle(s)
    setEditing(null)
    setSheetOpen(true)
  }
  function openEdit(route: ClimbingRoute) {
    setEditing(route)
    setSheetOpen(true)
  }
  // Remember the session's grade system and persist it as this gym's default (F20).
  function handleGradeSystemChange(next: 'standard' | 'gym') {
    setGradeSystem(next)
    if (venue === 'gym' && gymName) setGymGradePreference(gymName, next)
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
        title={session?.templateName ?? 'Climbing session'}
        elapsedSeconds={clock.elapsed}
        paused={clock.paused}
        onPause={clock.pause}
        onResume={clock.resume}
        onCancel={() => setConfirmCancel(true)}
        onFinish={finish}
      />

      <div className="space-y-5 p-4">
        {showRoutes &&
          (() => {
            const gymField = (
              <div className="space-y-1.5">
                <Label htmlFor="gym">Gym</Label>
                <Input
                  id="gym"
                  value={gym}
                  onChange={(e) => setGym(e.target.value)}
                  onBlur={() => void updateSession(id, { gym: gym.trim() || undefined })}
                  placeholder="optional"
                />
              </div>
            )
            const cragField = (
              <div className="space-y-1.5">
                <Label htmlFor="crag">Crag</Label>
                <Input
                  id="crag"
                  value={crag}
                  onChange={(e) => setCrag(e.target.value)}
                  onBlur={() => void updateSession(id, { crag: crag.trim() || undefined })}
                  placeholder="optional"
                />
              </div>
            )
            if (venue === 'home')
              return (
                <div className="space-y-1.5">
                  <Label htmlFor="board">Board</Label>
                  <Input
                    id="board"
                    value={board}
                    onChange={(e) => setBoard(e.target.value)}
                    onBlur={() => void updateSession(id, { board: board.trim() })}
                    placeholder="optional"
                  />
                </div>
              )
            if (venue === 'gym') return gymField
            if (venue === 'crag') return cragField
            // Template / repeat climbing sessions: offer both.
            return (
              <div className="grid grid-cols-2 gap-3">
                {gymField}
                {cragField}
              </div>
            )
          })()}

        {showExercises && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Exercises</p>
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
                  loggedSets={loggedForEx(ex)}
                  isCurrent={isCurrent}
                  prefillWeight={isCurrent ? prefill?.weightKg : undefined}
                  onLog={(d) => logExerciseSet(ex, d)}
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
            <Button variant="outline" className="w-full" onClick={() => setAddPickerOpen(true)}>
              <Plus className="size-4" /> Add exercise
            </Button>
          </div>
        )}

        {showHangs && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Hangboard</p>
            <SortableList
              items={hangWork}
              getUid={(h) => h.id}
              isComplete={isCompleteHang}
              isDimmed={(h) => h.skipped}
              currentUid={currentHang?.id}
              skipLabel="Skip hang"
              removeLabel="Remove hang"
              onReorder={reorderHangs}
              onSkip={skipHang}
              onRemove={setConfirmRemoveHangId}
              renderItem={(h, isCurrent) => (
                <HangCard
                  hangSet={h}
                  loggedHangs={loggedForHang(h)}
                  isCurrent={isCurrent}
                  skipped={h.skipped}
                  onAddSet={() => addSetToHang(h.id)}
                  onRemoveSet={() => removeHangSet(h.id)}
                  onEdit={(u) => editHang(h.id, u)}
                  onStartCountdown={() => startHangCountdown(h)}
                  countdown={
                    isCurrent && precount.activeUid === h.id
                      ? { remaining: precount.remaining, duration: precount.duration, precount: true }
                      : isCurrent && countdown.activeUid === h.id
                        ? { remaining: countdown.remaining, duration: countdown.duration }
                        : null
                  }
                />
              )}
            />
          </div>
        )}

        {showRoutes &&
          (() => {
            // One button per applicable style; Home is bouldering-only (A24).
            const styles: ClimbingStyle[] = isBoard
              ? ['bouldering']
              : ['bouldering', 'top_rope', 'lead']
            const gymRanges = venue === 'gym' ? getGymGradeRanges(gym.trim() || session?.gym || '') : null
            return (
              <div className="space-y-3">
                {isBoard ? (
                  <Button size="lg" className="w-full" onClick={() => openNew('bouldering')}>
                    <Plus className="size-5" /> Boulder
                  </Button>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {styles.map((s) => (
                      <Button key={s} onClick={() => openNew(s)}>
                        {STYLE_BTN_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                )}

                {routes.length === 0 ? (
                  <EmptyState
                    icon={Mountain}
                    title="No routes yet"
                    subtitle="Log your first climb of the session."
                  />
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {routes.length} route{routes.length === 1 ? '' : 's'} this session
                    </p>
                    {routes.map((r) => (
                      <RouteCard
                        key={r.id}
                        route={r}
                        gymRange={r.gymGrade != null ? gymRanges?.[r.style] : undefined}
                        onClick={() => openEdit(r)}
                        onDelete={() => setConfirmDeleteRouteId(r.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
      </div>

      <LogRouteSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        sessionId={id}
        editing={editing}
        venue={venue ?? 'crag'}
        style={newStyle}
        gymName={gymName}
        initialGradeSystem={gradeSystem}
        onGradeSystemChange={handleGradeSystemChange}
        onSaved={() => {
          clock.resume() // logging a route lifts any pause (F19)
          setEditing(null)
        }}
      />

      {rest.isRunning && (
        <RestTimer remaining={rest.remaining} duration={rest.duration} onSkip={rest.skip} />
      )}

      {showExercises && (
        <ExercisePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(exs) => exs[0] && swapCurrent(exs[0])}
        />
      )}
      <ExercisePicker
        open={addPickerOpen}
        onOpenChange={setAddPickerOpen}
        multiple
        onSelect={appendExercises}
      />

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

      <AlertDialog
        open={confirmRemoveLastHangId !== null}
        onOpenChange={(o) => !o && setConfirmRemoveLastHangId(null)}
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
            <AlertDialogAction onClick={doRemoveLastHang}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmRemoveUid !== null}
        onOpenChange={(o) => !o && setConfirmRemoveUid(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{removeName}” from this workout?</AlertDialogTitle>
            <AlertDialogDescription>Logged sets will be kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={doRemoveExercise}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmRemoveHangId !== null}
        onOpenChange={(o) => !o && setConfirmRemoveHangId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this hang set?</AlertDialogTitle>
            <AlertDialogDescription>Logged hangs will be kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={doRemoveHang}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeleteRouteId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteRouteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this route?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDeleteRoute}>Delete</AlertDialogAction>
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
    </div>
  )
}
