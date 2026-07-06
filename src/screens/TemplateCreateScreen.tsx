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
import { TemplateExerciseRow, type TemplateRow } from '@/components/TemplateExerciseRow'
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
import type { Exercise, ExerciseCategory, HangboardSet } from '@/types'

// A81 — the build-a-workout creation view. Mirrors the empty-session structure
// (name, add exercises, editable rows) but builds an in-memory draft and only
// writes a template on Save (no session record, no premature draft).

type CatFilter = 'all' | ExerciseCategory

// A79 fixed order.
const CATEGORY_TABS: { value: CatFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'hangboard', label: 'Hangboard' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'rehab', label: 'Rehab' },
]

export default function TemplateCreateScreen() {
  const navigate = useNavigate()
  const exercises = useLiveQuery(() => getAllExercises(), []) ?? []
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const defaultTags = useLiveQuery(() => getDefaultTags(), [])

  const [name, setName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagsSeeded, setTagsSeeded] = useState(false)
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [hangSets, setHangSets] = useState<HangboardSet[]>([])
  const [catFilter, setCatFilter] = useState<CatFilter>('all')
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

  // Category tabs (A79) filter which rows / the hang section are shown; reorder
  // works on the full list regardless of filter.
  const visibleRows = useMemo(() => {
    if (catFilter === 'hangboard') return []
    if (catFilter === 'all') return rows
    return rows.filter((r) => (exById.get(r.exerciseId)?.category ?? 'strength') === catFilter)
  }, [rows, catFilter, exById])
  const showHang = catFilter === 'all' || catFilter === 'hangboard'

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

  // A66-style: a workout spanning cardio/climbing, or carrying hangs, is 'mixed';
  // otherwise (strength and/or rehab) it's a strength template.
  function deriveType(): 'strength' | 'mixed' {
    if (hangSets.length > 0) return 'mixed'
    const hasOtherDiscipline = rows.some((r) => {
      const c = exById.get(r.exerciseId)?.category
      return c === 'cardio' || c === 'climbing'
    })
    return hasOtherDiscipline ? 'mixed' : 'strength'
  }

  async function save() {
    const trimmed = name.trim() || 'New workout'
    try {
      const id = await upsertTemplate({
        name: trimmed,
        type: deriveType(),
        tags,
        exercises: rows.map((r, i) => ({
          exerciseId: r.exerciseId,
          exerciseName: r.exerciseName,
          order: i,
          defaultSets: r.defaultSets,
          defaultReps: r.defaultReps,
          defaultDuration: r.defaultDuration,
          defaultWeight: r.defaultWeight,
          defaultRestSeconds: r.defaultRestSeconds,
          notes: r.notes,
        })),
        hangboardSets: hangSets.length ? hangSets.map((h, i) => ({ ...h, order: i })) : undefined,
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
          <Button size="sm" onClick={save}>
            Save
          </Button>
        }
      />

      <div className="space-y-5 p-4">
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

        <SegmentedControl options={CATEGORY_TABS} value={catFilter} onChange={setCatFilter} />

        <div className="space-y-3">
          {isEmpty ? (
            <EmptyState
              icon={Dumbbell}
              title="No exercises yet"
              subtitle="Add exercises to build your workout."
            />
          ) : (
            <>
              {visibleRows.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={visibleRows.map((r) => r.uid)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {visibleRows.map((row) => {
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
              )}

              {showHang && hangSets.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Hangboard</p>
                  <HangboardSetsEditor
                    value={hangSets}
                    onChange={(v) => {
                      setHangSets(v)
                      setDirty(true)
                    }}
                  />
                </div>
              )}

              {visibleRows.length === 0 && !(showHang && hangSets.length > 0) && (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Nothing in this category yet.
                </p>
              )}
            </>
          )}

          <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
            <Plus className="size-4" /> Add exercise
          </Button>
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
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
