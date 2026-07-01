import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Mountain, Plus } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import {
  addHang,
  addSet,
  checkAndSavePR,
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
import type { ClimbingRoute, ClimbingStyle, HangboardSet, LoggedSet } from '@/types'

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
  const loggedSets = useLiveQuery(() => getSetsForSession(id), [id]) ?? []

  const [gym, setGym] = useState('')
  const [crag, setCrag] = useState('')
  const [inited, setInited] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ClimbingRoute | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const clock = useSessionTimer(session?.startedAt ?? Date.now())

  useEffect(() => {
    if (session && !inited) {
      setGym(session.gym ?? '')
      setCrag(session.crag ?? '')
      setInited(true)
    }
  }, [session, inited])

  useEffect(() => {
    if (session && session.type !== 'climbing') navigate('/home', { replace: true })
  }, [session, navigate])

  const kind = template?.climbingKind
  const exercises = useMemo<WorkExercise[]>(
    () =>
      kind === 'workout'
        ? [...(template?.exercises ?? [])]
            .sort((a, b) => a.order - b.order)
            .map((e) => ({
              uid: `${e.exerciseId}-${e.order}`,
              exerciseId: e.exerciseId,
              exerciseName: e.exerciseName,
              targetSets: e.defaultSets,
              targetReps: e.defaultReps,
              restSeconds: e.defaultRestSeconds,
              skipped: false,
            }))
        : [],
    [kind, template?.exercises],
  )
  const hangSets = useMemo<HangboardSet[]>(
    () => [...(template?.hangboardSets ?? [])].sort((a, b) => a.order - b.order),
    [template?.hangboardSets],
  )

  const showExercises = exercises.length > 0
  const showHangs = hangSets.length > 0
  const showRoutes = !template || kind === 'workout'

  // Exercise logging (climbing-workout kind)
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
  const currentExIndex = exercises.findIndex((ex) => loggedForEx(ex).length < ex.targetSets)
  const currentEx = currentExIndex >= 0 ? exercises[currentExIndex] : undefined
  const prefill = useLiveQuery(
    () => (currentEx ? getLastSetForExercise(currentEx.exerciseId) : undefined),
    [currentEx?.exerciseId],
  )

  async function logExerciseSet(ex: WorkExercise, data: LoggedSetInput) {
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
    } catch {
      toast.error('Could not log set')
    }
  }

  // Hang logging
  const completedFor = (hs: HangboardSet) =>
    hangs.filter(
      (h) =>
        h.gripType === hs.gripType &&
        h.edgeDepthMm === hs.edgeDepthMm &&
        h.targetDurationSeconds === hs.durationSeconds,
    ).length
  const currentHangIndex = hangSets.findIndex((hs) => completedFor(hs) < hs.sets)

  async function logHang(hs: HangboardSet) {
    try {
      await addHang({
        sessionId: id,
        gripType: hs.gripType,
        edgeDepthMm: hs.edgeDepthMm,
        setNumber: completedFor(hs) + 1,
        targetDurationSeconds: hs.durationSeconds,
        actualDurationSeconds: hs.durationSeconds,
        weightKg: hs.weightKg,
        skipped: false,
        loggedAt: Date.now(),
      })
    } catch {
      toast.error('Could not log hang')
    }
  }

  async function saveGradePRs() {
    const cleanRoutes = routes.filter((r) => isCleanTick(r.tick))
    const styles: ClimbingStyle[] = ['bouldering', 'top_rope', 'lead']
    for (const style of styles) {
      const inStyle = cleanRoutes.filter((r) => r.style === style)
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

  function openNew() {
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

  return (
    <div className="min-h-dvh pb-24">
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
        {showRoutes && (
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
            {exercises.map((ex) => (
              <ExerciseCard
                key={ex.uid}
                exercise={ex}
                loggedSets={loggedForEx(ex)}
                isCurrent={ex.uid === currentEx?.uid}
                prefillWeight={ex.uid === currentEx?.uid ? prefill?.weightKg : undefined}
                onLog={(data) => logExerciseSet(ex, data)}
              />
            ))}
          </div>
        )}

        {showHangs && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Hangboard</p>
            {hangSets.map((hs, i) => (
              <HangCard
                key={hs.id}
                hangSet={hs}
                completedCount={completedFor(hs)}
                isCurrent={i === currentHangIndex}
                onLog={() => logHang(hs)}
              />
            ))}
          </div>
        )}

        {showRoutes && (
          <div className="space-y-3">
            <Button size="lg" className="w-full" onClick={openNew}>
              <Plus className="size-5" /> Log a route
            </Button>

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
                  <RouteCard key={r.id} route={r} onClick={() => openEdit(r)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <LogRouteSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        sessionId={id}
        editing={editing}
        onSaved={() => setEditing(null)}
      />

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
