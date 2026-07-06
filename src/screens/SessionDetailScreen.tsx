import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Check, Pencil, Play, Plus, Repeat, Save, Trash2 } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import {
  addSet,
  createTemplateFromSession,
  deleteRoute,
  deleteSession,
  deleteSet,
  getCardioForSession,
  getHangsForSession,
  getRoutesForSession,
  getSessionById,
  getSetsForSession,
  reopenSession,
  repeatSession,
  updateCardio,
  updateSession,
  updateSet,
} from '@/db/helpers'
import { ExercisePicker } from '@/components/ExercisePicker'
import { LogRouteSheet } from '@/components/LogRouteSheet'
import { PageHeader } from '@/components/PageHeader'
import { RouteCard } from '@/components/RouteCard'
import { TagInput } from '@/components/TagInput'
import { DisciplineBadge } from '@/components/DisciplineBadge'
import { badgeForSession, deriveSessionKind, normalizeVenue } from '@/lib/badges'
import { CLIMB_STYLE_ICONS } from '@/lib/climbing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
import { formatPace, formatWorkoutLength, workoutDurationSeconds } from '@/lib/formatDuration'
import type {
  ClimbingRoute,
  ClimbingStyle,
  Exercise,
  LoggedCardio,
  LoggedHang,
  LoggedSet,
} from '@/types'

function fullDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function SessionDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const session = useLiveQuery(() => getSessionById(id).then((s) => s ?? null), [id])
  const sets = useLiveQuery(() => getSetsForSession(id), [id]) ?? []
  const cardio = useLiveQuery(() => getCardioForSession(id), [id])
  const routes = useLiveQuery(() => getRoutesForSession(id), [id]) ?? []
  const hangs = useLiveQuery(() => getHangsForSession(id), [id]) ?? []

  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmResume, setConfirmResume] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [routeSheetOpen, setRouteSheetOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<ClimbingRoute | null>(null)
  const [newRouteStyle, setNewRouteStyle] = useState<ClimbingStyle>('bouldering')
  const [notes, setNotes] = useState('')
  const [notesInited, setNotesInited] = useState(false)
  // A61 — "Save as template" dialog state.
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateTags, setTemplateTags] = useState<string[]>([])

  useEffect(() => {
    if (session && !notesInited) {
      setNotes(session.notes ?? '')
      setNotesInited(true)
    }
  }, [session, notesInited])

  function openSaveTemplate() {
    if (!session) return
    setTemplateName(session.templateName)
    setTemplateTags([])
    setSaveTemplateOpen(true)
  }

  async function saveAsTemplate() {
    try {
      await createTemplateFromSession(id, templateName.trim() || session!.templateName, templateTags)
      setSaveTemplateOpen(false)
      toast.success('Template saved')
    } catch {
      toast.error('Could not save template')
    }
  }

  async function addSetToExercise(exerciseId: string, exerciseName: string) {
    const group = sets.filter((s) => s.exerciseId === exerciseId)
    const nextNum = group.length ? Math.max(...group.map((s) => s.setNumber)) + 1 : 1
    await addSet({
      sessionId: id,
      exerciseId,
      exerciseName,
      setNumber: nextNum,
      skipped: false,
      loggedAt: Date.now(),
    })
  }

  async function handleAddExercises(exs: Exercise[]) {
    for (const ex of exs) {
      await addSet({
        sessionId: id,
        exerciseId: ex.id,
        exerciseName: ex.name,
        setNumber: 1,
        skipped: false,
        loggedAt: Date.now(),
      })
    }
  }

  async function useAsWorkout() {
    if (!session) return
    try {
      const newId = await repeatSession(id)
      navigate(`/session/${session.type}/${newId}`)
    } catch {
      toast.error('Could not start workout')
    }
  }

  // Reactivate this same session and continue logging (F23) — distinct from
  // "Use as workout", which snapshots it onto a brand-new session.
  async function handleResume() {
    if (!session) return
    try {
      await reopenSession(id)
      navigate(`/session/${session.type}/${id}`)
    } catch {
      toast.error('Could not resume workout')
    }
  }

  async function handleDeleteSession() {
    try {
      await deleteSession(id)
      toast.success('Workout deleted')
      navigate('/history')
    } catch {
      toast.error('Could not delete workout')
    }
  }

  if (session === undefined) {
    return (
      <div className="min-h-dvh">
        <PageHeader title="Session" onBack={() => navigate('/history')} />
        <div className="space-y-2 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }
  if (session === null) {
    return (
      <div className="min-h-dvh">
        <PageHeader title="Not found" onBack={() => navigate('/history')} />
        <p className="p-4 text-muted-foreground">This session no longer exists.</p>
      </div>
    )
  }

  const durationSeconds = workoutDurationSeconds(session)
  const badge = badgeForSession(
    session,
    deriveSessionKind(session, {
      routes,
      hasHang: hangs.length > 0,
      hasSet: sets.length > 0,
      cardioActivity: cardio?.activityType,
    }),
  )

  const venue: 'gym' | 'crag' | 'board' | undefined =
    normalizeVenue(session.climbingVenue) ??
    (session.board !== undefined
      ? 'board'
      : session.crag !== undefined
        ? 'crag'
        : session.gym !== undefined
          ? 'gym'
          : undefined)

  // A61 — "Save as template" is for completed sessions that have a reusable
  // structure: any strength/cardio session, and climbing sessions that logged
  // exercises or hangs. Route-only climbing sessions (Gym/Crag/Board) have no
  // template structure, so it's hidden for them.
  const canSaveTemplate =
    session.endedAt != null &&
    (session.type === 'strength' ||
      session.type === 'cardio' ||
      (session.type === 'climbing' && (sets.length > 0 || hangs.length > 0)))

  return (
    <div className="min-h-dvh pb-6">
      <PageHeader
        title={session.templateName}
        onBack={() => navigate('/history')}
        right={
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={editing ? 'default' : 'ghost'}
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? <Check className="size-4" /> : <Pencil className="size-4" />}
              {editing ? 'Done' : 'Edit'}
            </Button>
            <button
              type="button"
              aria-label="Delete workout"
              onClick={() => setConfirmDelete(true)}
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        }
      />
      <div className="space-y-5 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DisciplineBadge badge={badge} />
          <span>{fullDate(session.startedAt)}</span>
          <span>· {formatWorkoutLength(durationSeconds)}</span>
        </div>

        {!editing && (
          <div className="flex flex-col gap-2">
            {session.endedAt != null && (
              <Button variant="outline" className="w-full" onClick={() => setConfirmResume(true)}>
                <Play className="size-4" /> Resume workout
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={useAsWorkout}>
              <Repeat className="size-4" /> Use as workout
            </Button>
            {canSaveTemplate && (
              <Button variant="outline" className="w-full" onClick={openSaveTemplate}>
                <Save className="size-4" /> Save as template
              </Button>
            )}
          </div>
        )}

        {session.type === 'strength' && (
          <StrengthDetail
            sets={sets}
            editing={editing}
            onAddExercise={() => setPickerOpen(true)}
            onAddSet={addSetToExercise}
          />
        )}
        {session.type === 'cardio' && <CardioDetail cardio={cardio} editing={editing} />}
        {session.type === 'climbing' && (
          <ClimbingDetail
            routes={routes}
            hangs={hangs}
            sets={sets}
            editing={editing}
            venue={venue}
            onAddExercise={() => setPickerOpen(true)}
            onAddSet={addSetToExercise}
            onEditRoute={(r) => {
              setEditingRoute(r)
              setRouteSheetOpen(true)
            }}
            onNewRoute={(s) => {
              setNewRouteStyle(s)
              setEditingRoute(null)
              setRouteSheetOpen(true)
            }}
            onDeleteRoute={(rid) => void deleteRoute(rid)}
          />
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Notes</p>
          {editing ? (
            <Textarea
              value={notes}
              rows={2}
              placeholder="Add notes…"
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void updateSession(id, { notes: notes.trim() || undefined })}
            />
          ) : session.notes ? (
            <p className="rounded-xl border border-border bg-card p-3 text-sm">{session.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes.</p>
          )}
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
        categories={session.type === 'climbing' ? ['climbing', 'rehab'] : ['strength', 'rehab']}
        onSelect={handleAddExercises}
      />
      <LogRouteSheet
        open={routeSheetOpen}
        onOpenChange={setRouteSheetOpen}
        sessionId={id}
        editing={editingRoute}
        venue={venue ?? 'crag'}
        cragSession={venue === 'crag'}
        style={newRouteStyle}
        gymName={session.gym}
        onSaved={() => setEditingRoute(null)}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the session and everything logged in it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmResume} onOpenChange={setConfirmResume}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              It will reopen as an active session and you can continue logging sets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResume}>Resume</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-template-name">Template name</Label>
              <Input
                id="new-template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <TagInput value={templateTags} onChange={setTemplateTags} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAsTemplate} disabled={!templateName.trim()}>
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- Strength ---------------------------------------------------------------

function groupByExercise(sets: LoggedSet[]): [string, string, LoggedSet[]][] {
  const map = new Map<string, { name: string; sets: LoggedSet[] }>()
  for (const s of sets) {
    const g = map.get(s.exerciseId) ?? { name: s.exerciseName, sets: [] }
    g.sets.push(s)
    map.set(s.exerciseId, g)
  }
  return [...map.entries()].map(([exId, g]) => [
    exId,
    g.name,
    g.sets.sort((a, b) => a.setNumber - b.setNumber),
  ])
}

function StrengthDetail({
  sets,
  editing,
  onAddExercise,
  onAddSet,
}: {
  sets: LoggedSet[]
  editing: boolean
  onAddExercise: () => void
  onAddSet: (exerciseId: string, exerciseName: string) => void
}) {
  const volume = sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.actualReps ?? 0), 0)
  const groups = groupByExercise(sets)

  if (sets.length === 0 && !editing) {
    return <p className="text-sm text-muted-foreground">No sets were logged.</p>
  }

  if (editing) {
    return (
      <div className="space-y-3">
        {groups.map(([exId, name, exSets]) => (
          <div key={exId} className="space-y-2 rounded-xl border border-border bg-card p-3">
            <p className="font-medium">{name}</p>
            {exSets.map((s) => (
              <EditableSetRow key={s.id} set={s} />
            ))}
            <Button variant="ghost" size="sm" onClick={() => onAddSet(exId, name)}>
              <Plus className="size-4" /> Add set
            </Button>
          </div>
        ))}
        <Button variant="outline" className="w-full" onClick={onAddExercise}>
          <Plus className="size-4" /> Add exercise
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Total sets" value={sets.length} />
        <Stat label="Volume" value={`${Math.round(volume)} kg`} />
      </div>
      <Accordion type="multiple" className="w-full">
        {groups.map(([exId, name, exSets]) => (
          <AccordionItem key={exId} value={exId}>
            <AccordionTrigger className="text-sm">
              <span className="flex-1 text-left">{name}</span>
              <span className="mr-2 text-muted-foreground">{exSets.length} sets</span>
            </AccordionTrigger>
            <AccordionContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-1 text-left font-normal">Set</th>
                    <th className="py-1 text-left font-normal">Weight</th>
                    <th className="py-1 text-left font-normal">Reps</th>
                  </tr>
                </thead>
                <tbody>
                  {exSets.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="py-1.5">{s.setNumber}</td>
                      <td className="py-1.5">{s.weightKg != null ? `${s.weightKg} kg` : 'BW'}</td>
                      <td className="py-1.5">{s.actualReps ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

function EditableSetRow({ set }: { set: LoggedSet }) {
  const [weight, setWeight] = useState(set.weightKg != null ? String(set.weightKg) : '')
  const [reps, setReps] = useState(set.actualReps != null ? String(set.actualReps) : '')

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v))

  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-sm text-muted-foreground">Set {set.setNumber}</span>
      <Input
        inputMode="decimal"
        className="h-9"
        placeholder="kg"
        value={weight}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.]/g, '')
          setWeight(v)
          void updateSet(set.id, { weightKg: num(v) })
        }}
      />
      <Input
        inputMode="numeric"
        className="h-9"
        placeholder="reps"
        value={reps}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, '')
          setReps(v)
          void updateSet(set.id, { actualReps: num(v) })
        }}
      />
      <button
        type="button"
        aria-label="Delete set"
        onClick={() => void deleteSet(set.id)}
        className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}

// --- Cardio -----------------------------------------------------------------

function CardioDetail({ cardio, editing }: { cardio: LoggedCardio | undefined; editing: boolean }) {
  const [distance, setDistance] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [inited, setInited] = useState(false)

  useEffect(() => {
    if (cardio && !inited) {
      setDistance(cardio.distanceKm != null ? String(cardio.distanceKm) : '')
      setDurationMin(String(Math.round(cardio.durationSeconds / 60)))
      setInited(true)
    }
  }, [cardio, inited])

  if (!cardio) return <p className="text-sm text-muted-foreground">No cardio was recorded.</p>

  function persist(km: string, durMin: string) {
    if (!cardio) return
    const kmNum = km.trim() === '' ? undefined : Number(km)
    const durationSeconds = durMin.trim() === '' ? cardio.durationSeconds : Number(durMin) * 60
    const avgPaceSecondsPerKm = kmNum && kmNum > 0 ? Math.round(durationSeconds / kmNum) : undefined
    void updateCardio(cardio.id, { distanceKm: kmNum, durationSeconds, avgPaceSecondsPerKm })
  }

  if (editing) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-distance">Distance (km)</Label>
          <Input
            id="edit-distance"
            inputMode="decimal"
            value={distance}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              setDistance(v)
              persist(v, durationMin)
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-duration">Duration (min)</Label>
          <Input
            id="edit-duration"
            inputMode="numeric"
            value={durationMin}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, '')
              setDurationMin(v)
              persist(distance, v)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Duration" value={formatWorkoutLength(cardio.durationSeconds)} />
        <Stat label="Distance" value={cardio.distanceKm != null ? `${cardio.distanceKm} km` : '—'} />
        <Stat
          label="Pace"
          value={cardio.avgPaceSecondsPerKm ? formatPace(cardio.avgPaceSecondsPerKm) : '—'}
        />
      </div>
      {cardio.intervals && cardio.intervals.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium text-muted-foreground">Interval splits</p>
          <table className="w-full text-sm">
            <tbody>
              {cardio.intervals.map((iv, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1.5">{iv.label}</td>
                  <td className="py-1.5 text-right text-muted-foreground tabular-nums">
                    {iv.durationSeconds}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// --- Climbing ---------------------------------------------------------------

const DETAIL_STYLE_LABELS: Record<ClimbingStyle, string> = {
  bouldering: 'Boulder',
  top_rope: 'Top rope',
  lead: 'Lead',
}

function ClimbingDetail({
  routes,
  hangs,
  sets,
  editing,
  venue,
  onAddExercise,
  onAddSet,
  onEditRoute,
  onNewRoute,
  onDeleteRoute,
}: {
  routes: ClimbingRoute[]
  hangs: LoggedHang[]
  sets: LoggedSet[]
  editing: boolean
  venue?: 'gym' | 'crag' | 'board'
  onAddExercise: () => void
  onAddSet: (exerciseId: string, exerciseName: string) => void
  onEditRoute: (r: ClimbingRoute) => void
  onNewRoute: (style: ClimbingStyle) => void
  onDeleteRoute: (id: string) => void
}) {
  const setsByExercise = new Map<string, number>()
  for (const s of sets) setsByExercise.set(s.exerciseName, (setsByExercise.get(s.exerciseName) ?? 0) + 1)
  const hasRoutes = routes.length > 0 || editing

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Routes" value={routes.length} />
        {hangs.length > 0 && <Stat label="Hangs" value={hangs.length} />}
        {sets.length > 0 && <Stat label="Sets" value={sets.length} />}
      </div>

      {/* Exercises — editable list (A33): add an exercise done-but-forgotten, then
          fill in weight/reps inline. Read-only summary when not editing. */}
      {editing ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Exercises</p>
          {groupByExercise(sets).map(([exId, name, exSets]) => (
            <div key={exId} className="space-y-2 rounded-xl border border-border bg-card p-3">
              <p className="font-medium">{name}</p>
              {exSets.map((s) => (
                <EditableSetRow key={s.id} set={s} />
              ))}
              <Button variant="ghost" size="sm" onClick={() => onAddSet(exId, name)}>
                <Plus className="size-4" /> Add set
              </Button>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={onAddExercise}>
            <Plus className="size-4" /> Add exercise
          </Button>
        </div>
      ) : (
        sets.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Exercises</p>
            {[...setsByExercise.entries()].map(([name, count]) => (
              <div key={name} className="flex justify-between rounded-lg bg-card px-3 py-2 text-sm">
                <span className="truncate">{name}</span>
                <span className="text-muted-foreground">
                  {count} set{count === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
        )
      )}

      {hangs.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Hangboard</p>
          {hangs.map((h) => (
            <div key={h.id} className="flex justify-between rounded-lg bg-card px-3 py-2 text-sm">
              <span className="truncate">{h.gripType}</span>
              <span className="text-muted-foreground">
                {h.edgeDepthMm}mm · {h.actualDurationSeconds ?? h.targetDurationSeconds}s ·{' '}
                {h.weightKg >= 0 ? '+' : ''}
                {h.weightKg}kg
              </span>
            </div>
          ))}
        </div>
      )}

      {hasRoutes && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Routes</p>
          {routes.length === 0 && !editing ? (
            <p className="text-sm text-muted-foreground">No routes were logged.</p>
          ) : (
            routes.map((r) =>
              editing ? (
                <div key={r.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <RouteCard route={r} onClick={() => onEditRoute(r)} />
                  </div>
                  <button
                    type="button"
                    aria-label="Delete route"
                    onClick={() => onDeleteRoute(r.id)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ) : (
                <RouteCard key={r.id} route={r} />
              ),
            )
          )}
          {editing &&
            (venue === 'board' ? (
              <Button variant="outline" className="w-full" onClick={() => onNewRoute('bouldering')}>
                {(() => {
                  const Icon = CLIMB_STYLE_ICONS.bouldering
                  return <Icon className="size-5" />
                })()}
                Boulder
              </Button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {(['bouldering', 'top_rope', 'lead'] as ClimbingStyle[]).map((s) => {
                  const Icon = CLIMB_STYLE_ICONS[s]
                  return (
                    <Button
                      key={s}
                      variant="outline"
                      onClick={() => onNewRoute(s)}
                      className="flex h-auto flex-col gap-1 py-2.5"
                    >
                      <Icon className="size-5" />
                      <span className="text-xs font-medium">{DETAIL_STYLE_LABELS[s]}</span>
                    </Button>
                  )
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
