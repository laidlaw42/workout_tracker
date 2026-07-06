import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useLiveQuery } from '@/hooks/useDb'
import { deleteTemplate, getTemplate, upsertTemplate } from '@/db/helpers'
import { generateId } from '@/lib/id'
import { ExercisePicker } from '@/components/ExercisePicker'
import { IntervalsEditor } from '@/components/IntervalsEditor'
import { HangboardSetsEditor } from '@/components/HangboardSetsEditor'
import { TemplateExerciseRow, type TemplateRow } from '@/components/TemplateExerciseRow'
import { PageHeader } from '@/components/PageHeader'
import { SegmentedControl } from '@/components/SegmentedControl'
import { TagInput } from '@/components/TagInput'
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
import type { CardioActivityType, Exercise, HangboardSet, IntervalBlock } from '@/types'

type Row = TemplateRow

const ACTIVITIES: { value: CardioActivityType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'ride', label: 'Ride' },
  { value: 'row', label: 'Row' },
  { value: 'other', label: 'Other' },
]

export default function TemplateEditScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  // A81 — new workouts are built in the dedicated creation view (TemplateCreate);
  // this screen only edits existing templates now.
  const template = useLiveQuery(() => getTemplate(id).then((t) => t ?? null), [id])

  const [name, setName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [activity, setActivity] = useState<CardioActivityType>('run')
  const [durationMin, setDurationMin] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [intervals, setIntervals] = useState<IntervalBlock[]>([])
  const [hangSets, setHangSets] = useState<HangboardSet[]>([])
  const [inited, setInited] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Initialise the editable draft once, when the template first loads.
  useEffect(() => {
    if (template && !inited) {
      setName(template.name)
      setTags(template.tags)
      setRows(template.exercises.map((e) => ({ ...e, uid: generateId() })))
      setActivity(template.cardioActivity ?? 'run')
      setDurationMin(
        template.targetDurationSeconds != null
          ? String(Math.round(template.targetDurationSeconds / 60))
          : '',
      )
      setDistanceKm(template.targetDistanceKm != null ? String(template.targetDistanceKm) : '')
      setIntervals(template.intervals ?? [])
      setHangSets(template.hangboardSets ?? [])
      setInited(true)
    }
  }, [template, inited])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      setRows((rs) => {
        const from = rs.findIndex((r) => r.uid === active.id)
        const to = rs.findIndex((r) => r.uid === over.id)
        return arrayMove(rs, from, to)
      })
      setDirty(true)
    }
  }

  function patchRow(uid: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)))
    setDirty(true)
  }

  function removeRow(uid: string) {
    setRows((rs) => rs.filter((r) => r.uid !== uid))
    setDirty(true)
  }

  // A73/F43 — hangboard exercises become hang rows seeded from their protocol
  // config; everything else becomes an exercise row (duration-tracked exercises
  // get a default hold time rather than reps).
  function addExercises(exs: Exercise[]) {
    const hangboardExs = exs.filter((e) => e.category === 'hangboard' && e.hangboard)
    const regularExs = exs.filter((e) => !(e.category === 'hangboard' && e.hangboard))
    if (regularExs.length) {
      setRows((rs) => [
        ...rs,
        ...regularExs.map((ex, i) => ({
          uid: generateId(),
          exerciseId: ex.id,
          exerciseName: ex.name,
          order: rs.length + i,
          defaultSets: 3,
          defaultReps: ex.trackingType === 'duration' ? undefined : 10,
          defaultDuration: ex.trackingType === 'duration' ? 30 : undefined,
          defaultRestSeconds: 90,
        })),
      ])
    }
    if (hangboardExs.length) {
      setHangSets((hs) => [
        ...hs,
        ...hangboardExs.map((ex, i) => ({
          id: generateId(),
          order: hs.length + i,
          ...ex.hangboard!,
        })),
      ])
    }
    setDirty(true)
  }

  async function save() {
    if (!template) return
    const isCardio = template.type === 'cardio'
    const isClimbing = template.type === 'climbing'
    // Exercise rows: strength, mixed, or a legacy climbing-workout template.
    const showExercises =
      template.type === 'strength' ||
      template.type === 'mixed' ||
      (isClimbing && template.climbingKind === 'workout')
    // Hang rows live on mixed (training) templates post-A73, plus legacy climbing.
    const showHangboard = template.type === 'mixed' || isClimbing
    try {
      await upsertTemplate({
        id: template.id,
        name: name.trim() || template.name,
        type: template.type,
        tags,
        exercises: showExercises
          ? rows.map((r, i) => ({
              exerciseId: r.exerciseId,
              exerciseName: r.exerciseName,
              order: i,
              defaultSets: r.defaultSets,
              defaultReps: r.defaultReps,
              defaultDuration: r.defaultDuration,
              defaultWeight: r.defaultWeight,
              defaultRestSeconds: r.defaultRestSeconds,
              notes: r.notes,
            }))
          : [],
        cardioActivity: isCardio ? activity : undefined,
        targetDurationSeconds:
          isCardio && durationMin.trim() ? Number(durationMin) * 60 : undefined,
        targetDistanceKm: isCardio && distanceKm.trim() ? Number(distanceKm) : undefined,
        intervals: isCardio && intervals.length > 0 ? intervals : undefined,
        climbingKind: isClimbing ? template.climbingKind : undefined,
        hangboardSets: showHangboard ? hangSets.map((h, i) => ({ ...h, order: i })) : undefined,
        lastUsedAt: template.lastUsedAt,
      })
      toast.success('Saved')
      navigate(`/library/${template.id}`)
    } catch {
      toast.error('Could not save template')
    }
  }

  function cancel() {
    // Only confirm when there are unsaved edits (A58 item 5 behaviour).
    if (dirty) setConfirmCancel(true)
    else navigate(`/library/${id}`)
  }

  function discard() {
    setConfirmCancel(false)
    navigate(`/library/${id}`)
  }

  async function doDelete() {
    // A77 — deletion lives here now. Removing the template never touches logged
    // sessions (they keep their own copy of the workout).
    try {
      await deleteTemplate(id)
      toast.success('Workout deleted')
      navigate('/library')
    } catch {
      toast.error('Could not delete workout')
    }
  }

  const isCardio = template?.type === 'cardio'
  const isClimbing = template?.type === 'climbing'
  const showExercises =
    template?.type === 'strength' ||
    template?.type === 'mixed' ||
    (isClimbing && template?.climbingKind === 'workout')
  const showHangboard = template?.type === 'mixed' || isClimbing

  return (
    <div className="min-h-dvh pb-24">
      <PageHeader
        title={inited ? name || 'Edit template' : 'Edit template'}
        onBack={cancel}
        right={
          <Button size="sm" onClick={save} disabled={!inited}>
            Save
          </Button>
        }
      />

      <div className="space-y-5 p-4">
        <div className="space-y-2">
          <Label htmlFor="tmpl-name">Name</Label>
          <Input
            id="tmpl-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setDirty(true)
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <TagInput
            value={tags}
            onChange={(t) => {
              setTags(t)
              setDirty(true)
            }}
          />
        </div>

        {showExercises && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Exercises</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={rows.map((r) => r.uid)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {rows.map((row) => (
                    <TemplateExerciseRow
                      key={row.uid}
                      row={row}
                      onChange={(patch) => patchRow(row.uid, patch)}
                      onRemove={() => removeRow(row.uid)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {rows.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No exercises yet. Add one below.
              </p>
            )}

            <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
              <Plus className="size-4" /> Add exercise
            </Button>
          </div>
        )}

        {isCardio && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Activity</Label>
              <SegmentedControl
                options={ACTIVITIES}
                value={activity}
                onChange={(v) => {
                  setActivity(v)
                  setDirty(true)
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="target-duration">Target duration (min)</Label>
                <Input
                  id="target-duration"
                  inputMode="numeric"
                  value={durationMin}
                  placeholder="optional"
                  onChange={(e) => {
                    setDurationMin(e.target.value.replace(/[^0-9]/g, ''))
                    setDirty(true)
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target-distance">Target distance (km)</Label>
                <Input
                  id="target-distance"
                  inputMode="decimal"
                  value={distanceKm}
                  placeholder="optional"
                  onChange={(e) => {
                    setDistanceKm(e.target.value.replace(/[^0-9.]/g, ''))
                    setDirty(true)
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Intervals</p>
              {intervals.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No intervals — add rounds for a structured session.
                </p>
              )}
              <IntervalsEditor
                value={intervals}
                onChange={(v) => {
                  setIntervals(v)
                  setDirty(true)
                }}
              />
            </div>
          </div>
        )}

        {showHangboard && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Hangboard</p>
            {hangSets.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No hangs yet — add grip/edge/duration sets below.
              </p>
            )}
            <HangboardSetsEditor
              value={hangSets}
              onChange={(v) => {
                setHangSets(v)
                setDirty(true)
              }}
            />
          </div>
        )}

        {/* A77 — deletion lives at the bottom of the edit screen, reached only
            after deliberately entering edit mode. */}
        <Button
          variant="ghost"
          className="w-full text-destructive"
          onClick={() => setConfirmDelete(true)}
          disabled={!inited}
        >
          <Trash2 className="size-4" /> Delete workout
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
        // A mixed (training) template can hold any discipline, so it uses the
        // grouped picker with a category tab row (Hangboard included, F43),
        // matching the session's build-your-own flow.
        grouped={template?.type === 'mixed'}
        categories={
          template?.type === 'climbing'
            ? ['climbing', 'rehab']
            : template?.type === 'mixed'
              ? undefined
              : ['strength', 'rehab']
        }
        onSelect={addExercises}
      />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Your edits will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={discard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              Your session history will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

