import { useEffect, useMemo, useState } from 'react'
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
import { deleteTemplate, getAllExercises, getTemplate, upsertTemplate } from '@/db/helpers'
import { generateId } from '@/lib/id'
import { templateExerciseFromExercise } from '@/lib/exerciseDefaults'
import { ExercisePicker } from '@/components/ExercisePicker'
import { IntervalsEditor } from '@/components/IntervalsEditor'
import { TemplateExerciseRow, type TemplateRow } from '@/components/TemplateExerciseRow'
import { CategoryMultiSelect } from '@/components/CategoryMultiSelect'
import { PageHeader } from '@/components/PageHeader'
import { SegmentedControl } from '@/components/SegmentedControl'
import { TagInput } from '@/components/TagInput'
import {
  buildToStoredCategories,
  storedToBuildCategories,
  type WorkoutCategory,
} from '@/lib/templateCategories'
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
import type {
  CardioActivityType,
  Exercise,
  ExerciseCategory,
  IntervalBlock,
} from '@/types'

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
  // Exercise tracking types drive the reps-vs-hold row variant (stable across a
  // cleared value, so clearing Hold can't silently flip a timed row to reps).
  const exercises = useLiveQuery(() => getAllExercises(), []) ?? []
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const [name, setName] = useState('')
  const [categories, setCategories] = useState<WorkoutCategory[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [activity, setActivity] = useState<CardioActivityType>('run')
  const [durationMin, setDurationMin] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [intervals, setIntervals] = useState<IntervalBlock[]>([])
  const [inited, setInited] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDropClimbing, setConfirmDropClimbing] = useState(false)

  // Initialise the editable draft once, when the template first loads.
  useEffect(() => {
    if (template && !inited) {
      setName(template.name)
      setCategories(storedToBuildCategories(template))
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

  // F51 — every exercise (hangboard grips included) becomes an exercise row;
  // duration-tracked exercises get a default hold time rather than reps.
  function addExercises(exs: Exercise[]) {
    // A98 — seed each row from the exercise's saved defaults (falling back to the
    // standard 3 × 10 · 90s when none are set).
    setRows((rs) => [
      ...rs,
      ...exs.map((ex, i) => ({
        uid: generateId(),
        ...templateExerciseFromExercise(ex, rs.length + i),
      })),
    ])
    setDirty(true)
  }

  function save() {
    if (!template || categories.length === 0) return
    // Deselecting Climbing drops the climbingKind — confirm first.
    const willDropClimbingKind = !!template.climbingKind && !categories.includes('climbing')
    if (willDropClimbingKind) {
      setConfirmDropClimbing(true)
      return
    }
    void doSave()
  }

  async function doSave() {
    if (!template || categories.length === 0) return
    setConfirmDropClimbing(false)
    try {
      await upsertTemplate({
        id: template.id,
        name: name.trim() || template.name,
        categories: buildToStoredCategories(categories),
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
              defaultDistanceKm: r.defaultDistanceKm,
              defaultRestSeconds: r.defaultRestSeconds,
              // F51 — preserve hangboard row params so a hang row round-trips.
              defaultEdgeDepthMm: r.defaultEdgeDepthMm,
              defaultIntraRestSeconds: r.defaultIntraRestSeconds,
              defaultAbrahangReps: r.defaultAbrahangReps,
              notes: r.notes,
            }))
          : [],
        cardioActivity: showCardio ? activity : undefined,
        targetDurationSeconds:
          showCardio && durationMin.trim() ? Number(durationMin) * 60 : undefined,
        targetDistanceKm: showCardio && distanceKm.trim() ? Number(distanceKm) : undefined,
        intervals: showCardio && intervals.length > 0 ? intervals : undefined,
        // climbingKind is preserved only for climbing templates (drives the
        // climbing session screen); undefined otherwise.
        climbingKind: categories.includes('climbing') ? template.climbingKind : undefined,
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

  // A94 — which content sections apply, derived from the (editable) build
  // categories. Exercises for any exercise discipline; cardio fields for cardio;
  // hang sets for Hangboard (its own pill now).
  const showExercises = categories.some((c) => c === 'strength' || c === 'climbing' || c === 'rehab')
  const showCardio = categories.includes('cardio')
  const showHangboard = categories.includes('hangboard')
  // The picker shows the selected exercise disciplines; Hangboard also offers hang
  // exercises (they seed hang rows).
  const pickerCategories: ExerciseCategory[] = [
    ...categories.filter((c): c is ExerciseCategory => c !== 'hangboard'),
    ...(showHangboard ? (['hangboard'] as ExerciseCategory[]) : []),
  ]

  return (
    <div className="min-h-dvh pb-24">
      <PageHeader
        title={inited ? name || 'Edit template' : 'Edit template'}
        onBack={cancel}
        right={
          <Button size="sm" onClick={save} disabled={!inited || categories.length === 0}>
            Save
          </Button>
        }
      />

      <div className="space-y-5 p-4">
        {/* A94 — the categories multi-select is the source of truth for the
            Library tabs, the ExercisePicker scope, and the sections shown below. */}
        <div className="space-y-2">
          <Label>Categories</Label>
          <CategoryMultiSelect
            value={categories}
            onChange={(c) => {
              setCategories(c)
              setDirty(true)
            }}
          />
          {categories.length === 0 && (
            <p className="text-xs text-destructive">Select at least one category.</p>
          )}
        </div>

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
                  {rows.map((row) => {
                    const ex = exById.get(row.exerciseId)
                    return (
                      <TemplateExerciseRow
                        key={row.uid}
                        row={row}
                        timed={ex ? ex.trackingType === 'duration' : undefined}
                        onChange={(patch) => patchRow(row.uid, patch)}
                        onRemove={() => removeRow(row.uid)}
                      />
                    )
                  })}
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

        {showCardio && (
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
        // A94 — the picker scope is exactly this template's categories (climbing
        // also offers hangboard exercises, which seed hang rows).
        categories={pickerCategories}
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

      <AlertDialog open={confirmDropClimbing} onOpenChange={setConfirmDropClimbing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove hangboard from this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              This workout’s hangboard sets will be deleted when you save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void doSave()}>
              Remove and save
            </AlertDialogAction>
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
            <AlertDialogAction variant="destructive" onClick={doDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

