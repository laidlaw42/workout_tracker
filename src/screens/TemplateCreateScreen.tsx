import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Dumbbell, Plus } from 'lucide-react'
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
import { getAllExercises, getDefaultTags, upsertTemplate } from '@/db/helpers'
import { generateId } from '@/lib/id'
import { ExercisePicker } from '@/components/ExercisePicker'
import { HangboardSetsEditor } from '@/components/HangboardSetsEditor'
import { IntervalsEditor } from '@/components/IntervalsEditor'
import { TemplateExerciseRow, type TemplateRow } from '@/components/TemplateExerciseRow'
import { CategoryMultiSelect } from '@/components/CategoryMultiSelect'
import { PageHeader } from '@/components/PageHeader'
import { SegmentedControl } from '@/components/SegmentedControl'
import { TagInput } from '@/components/TagInput'
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
import type {
  CardioActivityType,
  Exercise,
  ExerciseCategory,
  HangboardSet,
  IntervalBlock,
  TemplateCategory,
} from '@/types'

// A94 — the build-a-workout creation view. Mirrors the home "Start new workout"
// (empty-session) screen — name, add exercises, editable rows — with a category
// multi-select along the top. Builds an in-memory draft; writes a template only on
// Save (no session record). The chosen categories scope the picker + which
// discipline sections show, and are the source of truth for the Library tabs.

const ACTIVITIES: { value: CardioActivityType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'ride', label: 'Ride' },
  { value: 'row', label: 'Row' },
  { value: 'other', label: 'Other' },
]

export default function TemplateCreateScreen() {
  const navigate = useNavigate()
  const exercises = useLiveQuery(() => getAllExercises(), []) ?? []
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const defaultTags = useLiveQuery(() => getDefaultTags(), [])

  const [categories, setCategories] = useState<TemplateCategory[]>([])
  const [name, setName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagsSeeded, setTagsSeeded] = useState(false)
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [hangSets, setHangSets] = useState<HangboardSet[]>([])
  const [activity, setActivity] = useState<CardioActivityType>('run')
  const [durationMin, setDurationMin] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [intervals, setIntervals] = useState<IntervalBlock[]>([])
  const [dirty, setDirty] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Pre-apply the user's default tags (A35) once the query resolves — but never
  // clobber tags the user already typed while it was loading (keep theirs).
  useEffect(() => {
    if (!tagsSeeded && defaultTags) {
      setTags((prev) => (prev.length ? prev : defaultTags))
      setTagsSeeded(true)
    }
  }, [defaultTags, tagsSeeded])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Which discipline sections show. Exercises show by default (before any category
  // is picked, so the screen opens like "Start new workout") and for any non-cardio
  // discipline; cardio fields for cardio; hangboard for climbing (A92).
  const showExercises = categories.length === 0 || categories.some((c) => c !== 'cardio')
  const showCardio = categories.includes('cardio')
  const showHangboard = categories.includes('climbing')
  // Picker scope = the selected categories (climbing also offers hangboard); before
  // any are selected, show everything so exercises can be added freely.
  const pickerCategories: ExerciseCategory[] | undefined =
    categories.length === 0
      ? undefined
      : categories.includes('climbing')
        ? [...categories, 'hangboard']
        : categories

  function setCats(next: TemplateCategory[]) {
    setCategories(next)
    setDirty(true)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      setRows((rs) => {
        const from = rs.findIndex((r) => r.uid === active.id)
        const to = rs.findIndex((r) => r.uid === over.id)
        return from < 0 || to < 0 ? rs : arrayMove(rs, from, to)
      })
      setDirty(true)
    }
  }

  function patchRow(uid: string, patch: Partial<TemplateRow>) {
    setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)))
    setDirty(true)
  }
  function removeRow(uid: string) {
    setRows((rs) => rs.filter((r) => r.uid !== uid))
    setDirty(true)
  }

  // Hangboard exercises become hang rows seeded from their protocol; everything
  // else becomes an exercise row (F43 / mirrors TemplateEditScreen.addExercises).
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
        ...hangboardExs.map((ex, i) => ({ id: generateId(), order: hs.length + i, ...ex.hangboard! })),
      ])
    }
    setDirty(true)
  }

  async function save() {
    if (categories.length === 0) return
    const trimmed = name.trim() || 'New workout'
    try {
      const id = await upsertTemplate({
        name: trimmed,
        categories,
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
        cardioActivity: showCardio ? activity : undefined,
        targetDurationSeconds: showCardio && durationMin.trim() ? Number(durationMin) * 60 : undefined,
        targetDistanceKm: showCardio && distanceKm.trim() ? Number(distanceKm) : undefined,
        intervals: showCardio && intervals.length > 0 ? intervals : undefined,
        hangboardSets:
          showHangboard && hangSets.length ? hangSets.map((h, i) => ({ ...h, order: i })) : undefined,
      })
      navigate(`/library/${id}`)
    } catch {
      toast.error('Could not create workout')
    }
  }

  function cancel() {
    if (dirty) setConfirmCancel(true)
    else navigate('/library')
  }
  function discard() {
    setConfirmCancel(false)
    navigate('/library')
  }

  const isEmpty = rows.length === 0 && hangSets.length === 0

  return (
    <div className="min-h-dvh pb-24">
      <PageHeader
        title={name.trim() || 'New workout'}
        onBack={cancel}
        right={
          <Button size="sm" onClick={save} disabled={categories.length === 0}>
            Save
          </Button>
        }
      />

      <div className="space-y-5 p-4">
        {/* A94 — categories sit along the top; ≥1 is required to save and scopes the
            exercise picker + the sections shown below. */}
        <div className="space-y-2">
          <Label>Categories</Label>
          <CategoryMultiSelect value={categories} onChange={setCats} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-name">Name</Label>
          <Input
            id="new-name"
            value={name}
            placeholder="e.g. Upper B"
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
            {isEmpty ? (
              <EmptyState
                icon={Dumbbell}
                title="No exercises yet"
                subtitle="Add exercises to build your workout."
              />
            ) : (
              rows.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
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
              )
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

        {showHangboard && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Hangboard</p>
            {hangSets.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No hangs yet — add hangboard exercises above, or grip/edge sets below.
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
      </div>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
        categories={pickerCategories}
        onSelect={addExercises}
      />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this workout?</AlertDialogTitle>
            <AlertDialogDescription>Your changes will not be saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={discard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
