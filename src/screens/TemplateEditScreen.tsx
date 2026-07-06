import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLiveQuery } from '@/hooks/useDb'
import { deleteTemplate, getTemplate, upsertTemplate } from '@/db/helpers'
import { generateId } from '@/lib/id'
import { ExercisePicker } from '@/components/ExercisePicker'
import { IntervalsEditor } from '@/components/IntervalsEditor'
import { HangboardSetsEditor } from '@/components/HangboardSetsEditor'
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
import type {
  CardioActivityType,
  Exercise,
  HangboardSet,
  IntervalBlock,
  TemplateExercise,
} from '@/types'

type Row = TemplateExercise & { uid: string }

const ACTIVITIES: { value: CardioActivityType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'ride', label: 'Ride' },
  { value: 'row', label: 'Row' },
  { value: 'other', label: 'Other' },
]

export default function TemplateEditScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  // New-template mode (A58): LibraryScreen appends ?new=1 when it creates a draft
  // and opens the editor. Backing out of a brand-new template prompts to discard
  // and removes the empty draft, rather than leaving a "New workout" behind.
  const [searchParams] = useSearchParams()
  const isNew = searchParams.get('new') === '1'
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

  function addExercises(exs: Exercise[]) {
    setRows((rs) => [
      ...rs,
      ...exs.map((ex, i) => ({
        uid: generateId(),
        exerciseId: ex.id,
        exerciseName: ex.name,
        order: rs.length + i,
        defaultSets: 3,
        defaultReps: 10,
        defaultRestSeconds: 90,
      })),
    ])
    setDirty(true)
  }

  async function save() {
    if (!template) return
    const isCardio = template.type === 'cardio'
    const isClimbing = template.type === 'climbing'
    const showExercises =
      template.type === 'strength' || (isClimbing && template.climbingKind === 'workout')
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
        hangboardSets: isClimbing ? hangSets.map((h, i) => ({ ...h, order: i })) : undefined,
        lastUsedAt: template.lastUsedAt,
      })
      toast.success('Saved')
      navigate(`/library/${template.id}`)
    } catch {
      toast.error('Could not save template')
    }
  }

  function cancel() {
    // New template: always confirm (the draft is discarded on confirm). Existing
    // template: only confirm when there are unsaved edits (item 5 behaviour).
    if (isNew || dirty) setConfirmCancel(true)
    else navigate(`/library/${id}`)
  }

  async function discard() {
    setConfirmCancel(false)
    if (isNew) {
      // The draft was persisted when creation started; remove it so an abandoned
      // new workout doesn't linger in the library, then return to the list.
      try {
        await deleteTemplate(id)
      } catch {
        /* fall through — navigate away regardless */
      }
      navigate('/library')
    } else {
      navigate(`/library/${id}`)
    }
  }

  const isCardio = template?.type === 'cardio'
  const isClimbing = template?.type === 'climbing'
  const showExercises =
    template?.type === 'strength' || (isClimbing && template?.climbingKind === 'workout')

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
                    <SortableRow
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

        {isClimbing && (
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
      </div>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
        categories={template?.type === 'climbing' ? ['climbing', 'rehab'] : ['strength', 'rehab']}
        onSelect={addExercises}
      />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isNew ? 'Discard this workout?' : 'Discard changes?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isNew ? 'Your changes will not be saved.' : 'Your edits will be lost.'}
            </AlertDialogDescription>
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

interface RowProps {
  row: Row
  onChange: (patch: Partial<Row>) => void
  onRemove: () => void
}

function SortableRow({ row, onChange, onRemove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.uid,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`space-y-2 rounded-xl border border-border bg-card p-3 ${isDragging ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex size-8 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-5" />
        </button>
        <span className="flex-1 truncate font-medium">{row.exerciseName}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove exercise"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-accent"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumField
          label="Sets"
          value={row.defaultSets}
          onChange={(v) => onChange({ defaultSets: v ?? 0 })}
        />
        <NumField
          label="Reps"
          value={row.defaultReps}
          onChange={(v) => onChange({ defaultReps: v })}
        />
        <NumField
          label="Rest (s)"
          value={row.defaultRestSeconds}
          onChange={(v) => onChange({ defaultRestSeconds: v ?? 0 })}
        />
      </div>
    </div>
  )
}

interface NumFieldProps {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}

function NumField({ label, value, onChange }: NumFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        inputMode="numeric"
        className="h-9"
        value={value ?? ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, '')
          onChange(digits === '' ? undefined : Number(digits))
        }}
      />
    </label>
  )
}
