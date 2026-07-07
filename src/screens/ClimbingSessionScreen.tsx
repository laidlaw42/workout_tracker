import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Mountain, Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useWakeLock } from '@/hooks/useWakeLock'
import { useTimedSetEngine, type WorkHang } from '@/hooks/useTimedSetEngine'
import { getKeepAwake, getGymAreas } from '@/lib/prefs'
import {
  checkAndSavePR,
  deleteRoute,
  deleteSession,
  endSession,
  getAllExercises,
  getHangsForSession,
  getLastSetForExercise,
  getRoutesForSession,
  getSessionById,
  getSetsForSession,
  getTemplate,
  updateSession,
} from '@/db/helpers'
import {
  CLIMB_STYLE_ICONS,
  CLIMB_STYLE_TONE,
  STYLE_LABELS,
  isCleanTick,
  routeGapSeconds,
  vGradeIndex,
} from '@/lib/climbing'
import { normalizeVenue } from '@/lib/badges'
import { resolveExerciseDefaults } from '@/lib/exerciseDefaults'
import { patchById, removeById, reorderKeepingComplete, updateById } from '@/lib/workQueue'
import { SessionHeader } from '@/components/SessionHeader'
import { SelectPill } from '@/components/SelectPill'
import { RouteCard } from '@/components/RouteCard'
import { LogRouteSheet } from '@/components/LogRouteSheet'
import { ExerciseCard, type WorkExercise } from '@/components/ExerciseCard'
import { HangCard } from '@/components/HangCard'
import { SortableList } from '@/components/SortableList'
import { RestTimer } from '@/components/RestTimer'
import { ExercisePicker } from '@/components/ExercisePicker'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SessionLocationPills } from '@/components/SessionLocationPills'
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

// uid accessors for the shared work-queue transforms (exercises key by uid, hangs
// by id).
const exUid = (e: WorkExercise) => e.uid
const hangUid = (h: WorkHang) => h.id

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
  const hangsRaw = useLiveQuery(() => getHangsForSession(id), [id])
  const hangs = hangsRaw ?? []
  const loggedSetsRaw = useLiveQuery(() => getSetsForSession(id), [id])
  const loggedSets = loggedSetsRaw ?? []
  // For the +kg additional-weight field and the F39 empty-weight warning gating.
  const exercises = useLiveQuery(() => getAllExercises(), []) ?? []
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const [gym, setGym] = useState('')
  const [crag, setCrag] = useState('')
  const [board, setBoard] = useState('')
  const [inited, setInited] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ClimbingRoute | null>(null)
  const [newStyle, setNewStyle] = useState<ClimbingStyle>('bouldering')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmDeleteRouteId, setConfirmDeleteRouteId] = useState<string | null>(null)
  // Active gym-area filter for the logged-route list (A70). '' = All.
  const [areaFilter, setAreaFilter] = useState('')

  const clock = useSessionTimer(id, session?.startedAt ?? Date.now(), session?.pausedDuration ?? 0)
  useWakeLock(getKeepAwake())

  // Which venue field to show. Prefer the explicit discriminator; fall back to
  // field presence for sessions created before it existed.
  const venue: 'gym' | 'crag' | 'board' | undefined =
    normalizeVenue(session?.climbingVenue) ??
    (session?.board !== undefined
      ? 'board'
      : session?.crag !== undefined
        ? 'crag'
        : session?.gym !== undefined
          ? 'gym'
          : undefined)
  const isBoard = venue === 'board'
  const isGym = venue === 'gym'
  const gymName = gym.trim() || session?.gym || undefined

  // A70 — area filter pills for gym sessions; A67 — time gap before each route.
  const gymAreas = useMemo(() => (isGym ? getGymAreas(gymName ?? '') : []), [isGym, gymName])
  const gaps = useMemo(
    () =>
      session?.startedAt != null
        ? routeGapSeconds(routes, session.startedAt)
        : new Map<string, number>(),
    [routes, session?.startedAt],
  )
  const shownRoutes = areaFilter ? routes.filter((r) => r.gymArea === areaFilter) : routes

  // A78 — the session's chosen location name (gym/crag/board), driven by the
  // pills row near the top of the screen. Optional; '' means no name.
  const locName =
    venue === 'gym'
      ? gym.trim()
      : venue === 'crag'
        ? crag.trim()
        : venue === 'board'
          ? board.trim()
          : ''
  function setLocation(name: string) {
    const n = name.trim()
    if (venue === 'gym') {
      setGym(n)
      void updateSession(id, { gym: n || undefined })
    } else if (venue === 'crag') {
      setCrag(n)
      void updateSession(id, { crag: n || undefined })
    } else if (venue === 'board') {
      setBoard(n)
      void updateSession(id, { board: n }) // '' still keeps the board flavour detectable
    }
  }

  useEffect(() => {
    if (session && !inited) {
      setGym(session.gym ?? '')
      setCrag(session.crag ?? '')
      setBoard(session.board ?? '')
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
          weight: e.defaultWeight, // A98 — template default weight pre-fills the row
          distanceKm: e.defaultDistanceKm,
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
  const prefillRaw = useLiveQuery(
    () => (currentEx ? getLastSetForExercise(currentEx.exerciseId) : undefined),
    [currentEx?.exerciseId],
  )
  // Ignore a stale prefill still holding the previous exercise's set (F22).
  const prefill = prefillRaw?.exerciseId === currentEx?.exerciseId ? prefillRaw : undefined

  function addSetTo(uid: string) {
    setWork((w) => updateById(w, exUid, uid, (e) => ({ ...e, targetSets: e.targetSets + 1 })))
  }
  // Inline edit (A31) — applies to the exercise's remaining unlogged sets.
  function editExercise(uid: string, updates: Partial<WorkExercise>) {
    setWork((w) => patchById(w, exUid, uid, updates))
  }
  function skip(uid: string) {
    setWork((w) => patchById(w, exUid, uid, { skipped: true }))
    if (uid === currentEx?.uid) engine.cancelTimers()
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
    setWork((w) => reorderKeepingComplete(w, exUid, isComplete, activeUids))
  }
  function doRemoveExercise() {
    if (!confirmRemoveUid) return
    setWork((w) => removeById(w, exUid, confirmRemoveUid))
    setConfirmRemoveUid(null)
  }
  function removeSet(uid: string) {
    const ex = work.find((e) => e.uid === uid)
    if (!ex) return
    if (ex.targetSets <= 1) {
      setConfirmRemoveLastUid(uid)
      return
    }
    setWork((w) => updateById(w, exUid, uid, (e) => ({ ...e, targetSets: e.targetSets - 1 })))
  }
  function doRemoveLast() {
    if (!confirmRemoveLastUid) return
    setWork((w) => removeById(w, exUid, confirmRemoveLastUid))
    setConfirmRemoveLastUid(null)
  }
  function appendExercises(exs: Exercise[]) {
    if (!exs.length) return
    const stamp = Date.now()
    // A98 — seed each row from the exercise's saved defaults (fallback 3 × 10 · 90s).
    setWork((w) => [
      ...w,
      ...exs.map((ex, i) => {
        const r = resolveExerciseDefaults(ex)
        return {
          uid: `${ex.id}-add-${stamp}-${i}`,
          exerciseId: ex.id,
          exerciseName: ex.name,
          targetSets: r.sets,
          targetReps: r.reps,
          durationSeconds: r.durationSeconds,
          weight: r.weightKg,
          distanceKm: r.distanceKm,
          restSeconds: r.restSeconds,
          skipped: false,
        }
      }),
    ])
    setAddPickerOpen(false)
  }

  // --- Hang logging (hangboard) -------------------------------------------
  const loggedForHang = (hs: HangboardSet) =>
    hangs.filter((h) => h.hangSetId === hs.id).sort((a, b) => a.setNumber - b.setNumber)
  const completedFor = (hs: HangboardSet) => loggedForHang(hs).length
  const isCompleteHang = (h: WorkHang) => h.skipped || completedFor(h) >= h.sets
  const currentHang = hangWork.find((h) => !isCompleteHang(h))

  // CA1 — the shared timed-set engine (same one the training screen uses): three
  // timers, log→rest→auto-advance for exercises and hangs, and the F48
  // persist/resume. Ready once the plan + logged data have loaded so the resume
  // picks the right item; a route-only session has no timed phase to resume.
  const engine = useTimedSetEngine({
    sessionId: id,
    paused: clock.paused,
    resume: clock.resume,
    work,
    hangWork,
    exById,
    loggedCountFor: (ex) => loggedForEx(ex).length,
    isComplete,
    completedForHang: completedFor,
    isCompleteHang,
    ready:
      template !== undefined &&
      loggedSetsRaw !== undefined &&
      hangsRaw !== undefined &&
      !((hasExercises && !workInited) || (hasHangs && !hangWorkInited)),
  })

  function addSetToHang(hid: string) {
    setHangWork((w) => updateById(w, hangUid, hid, (h) => ({ ...h, sets: h.sets + 1 })))
  }
  // Inline edit (A31) — applies to the set's remaining unlogged hangs.
  function editHang(hid: string, updates: Partial<HangboardSet>) {
    setHangWork((w) => patchById(w, hangUid, hid, updates))
  }
  function skipHang(hid: string) {
    setHangWork((w) => patchById(w, hangUid, hid, { skipped: true }))
    if (hid === currentHang?.id) engine.cancelTimers()
  }
  function reorderHangs(activeIds: string[]) {
    setHangWork((w) => reorderKeepingComplete(w, hangUid, isCompleteHang, activeIds))
  }
  function doRemoveHang() {
    if (!confirmRemoveHangId) return
    setHangWork((w) => removeById(w, hangUid, confirmRemoveHangId))
    setConfirmRemoveHangId(null)
  }
  function removeHangSet(hid: string) {
    const h = hangWork.find((x) => x.id === hid)
    if (!h) return
    if (h.sets <= 1) {
      setConfirmRemoveLastHangId(hid)
      return
    }
    setHangWork((w) => updateById(w, hangUid, hid, (x) => ({ ...x, sets: x.sets - 1 })))
  }
  function doRemoveLastHang() {
    if (!confirmRemoveLastHangId) return
    setHangWork((w) => removeById(w, hangUid, confirmRemoveLastHangId))
    setConfirmRemoveLastHangId(null)
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
    engine.clearPhase() // F48 — the session is ending; drop any persisted timed phase
    try {
      await saveGradePRs()
      await endSession(id)
      navigate(`/session/${id}/summary`)
    } catch {
      toast.error('Could not finish session')
    }
  }
  async function handleCancel() {
    engine.clearPhase()
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
        title={locName || session?.templateName || 'Climbing session'}
        elapsedSeconds={clock.elapsed}
        paused={clock.paused}
        onPause={clock.pause}
        onResume={clock.resume}
        onCancel={() => setConfirmCancel(true)}
        onFinish={finish}
      />

      <div className="space-y-5 p-4">
        {/* A78 — pick the gym/board/crag inline; optional, above the climb-type
            buttons. Gated on `inited` so the name is hydrated before the pills
            mount (no "New …" input flash on resume/default). Undefined-venue
            (legacy template/repeat) keeps text fields. */}
        {showRoutes && venue !== undefined && inited && (
          <SessionLocationPills venue={venue} value={locName} onChange={setLocation} />
        )}
        {showRoutes && venue === undefined && (
          <div className="grid grid-cols-2 gap-3">
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
          </div>
        )}

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
                  prefill={isCurrent ? prefill : undefined}
                  supportsAdditionalWeight={exById.get(ex.exerciseId)?.supportsAdditionalWeight}
                  onLog={(d) => engine.logSet(ex, d)}
                  onAddSet={() => addSetTo(ex.uid)}
                  onRemoveSet={() => removeSet(ex.uid)}
                  onSwap={isCurrent ? () => setPickerOpen(true) : undefined}
                  onEdit={(u) => editExercise(ex.uid, u)}
                  onStartCountdown={() => engine.startTimedSet(ex)}
                  countdown={
                    isCurrent && engine.precount.activeUid === ex.uid
                      ? { remaining: engine.precount.remaining, duration: engine.precount.duration, precount: true }
                      : isCurrent && engine.countdown.activeUid === ex.uid
                        ? { remaining: engine.countdown.remaining, duration: engine.countdown.duration }
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
                  onStartCountdown={() => engine.startHang(h)}
                  countdown={
                    isCurrent && engine.precount.activeUid === h.id
                      ? { remaining: engine.precount.remaining, duration: engine.precount.duration, precount: true }
                      : isCurrent && engine.countdown.activeUid === h.id
                        ? {
                            remaining: engine.countdown.remaining,
                            duration: engine.countdown.duration,
                            label: engine.abrahangLabel ?? undefined,
                          }
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
            return (
              <div className="space-y-3">
                {isBoard ? (
                  <Button
                    size="lg"
                    className={`w-full ring-1 ${CLIMB_STYLE_TONE.bouldering}`}
                    onClick={() => openNew('bouldering')}
                  >
                    {(() => {
                      const Icon = CLIMB_STYLE_ICONS.bouldering
                      return <Icon className="size-5" />
                    })()}
                    Boulder
                  </Button>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {styles.map((s) => {
                      const Icon = CLIMB_STYLE_ICONS[s]
                      return (
                        <Button
                          key={s}
                          onClick={() => openNew(s)}
                          className={`flex h-auto flex-col gap-1 py-2.5 ring-1 ${CLIMB_STYLE_TONE[s]}`}
                        >
                          <Icon className="size-5" />
                          <span className="text-xs font-medium">{STYLE_BTN_LABELS[s]}</span>
                        </Button>
                      )
                    })}
                  </div>
                )}

                {isGym && gymAreas.length > 0 && routes.length > 0 && (
                  <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                    <SelectPill label="All" active={!areaFilter} onClick={() => setAreaFilter('')} />
                    {gymAreas.map((a) => (
                      <SelectPill
                        key={a}
                        label={a}
                        active={areaFilter === a}
                        onClick={() => setAreaFilter(a)}
                      />
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
                      {areaFilter
                        ? `${shownRoutes.length} in ${areaFilter}`
                        : `${routes.length} route${routes.length === 1 ? '' : 's'} this session`}
                    </p>
                    {shownRoutes.map((r) => (
                      <RouteCard
                        key={r.id}
                        route={r}
                        gapSeconds={gaps.get(r.id)}
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
        cragSession={venue === 'crag'}
        style={newStyle}
        gymName={gymName}
        onSaved={() => {
          clock.resume() // logging a route lifts any pause (F19)
          setEditing(null)
        }}
      />

      {engine.rest.isRunning && (
        <RestTimer
          remaining={engine.rest.remaining}
          duration={engine.rest.duration}
          paused={clock.paused}
          onSkip={() => {
            engine.rest.skip()
            engine.clearPhase() // F48 — a manual skip ends the timed flow
          }}
        />
      )}

      {showExercises && (
        <ExercisePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          categories={['climbing', 'rehab']}
          onSelect={(exs) => exs[0] && swapCurrent(exs[0])}
        />
      )}
      <ExercisePicker
        open={addPickerOpen}
        onOpenChange={setAddPickerOpen}
        multiple
        categories={['climbing', 'rehab']}
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
            <AlertDialogAction variant="destructive" onClick={doDeleteRoute}>
              Delete
            </AlertDialogAction>
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
            <AlertDialogAction variant="destructive" onClick={handleCancel}>
              Discard workout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
