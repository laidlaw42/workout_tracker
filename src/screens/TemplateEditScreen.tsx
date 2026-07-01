import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { getTemplate, upsertTemplate } from '@/db/helpers'
import { generateId } from '@/lib/id'
import { ExercisePicker } from '@/components/ExercisePicker'
import { PageHeader } from '@/components/PageHeader'
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
import type { Exercise, TemplateExercise } from '@/types'

type Row = TemplateExercise & { uid: string }

export default function TemplateEditScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const template = useLiveQuery(() => getTemplate(id).then((t) => t ?? null), [id])

  const [name, setName] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [inited, setInited] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Initialise the editable draft once, when the template first loads.
  useEffect(() => {
    if (template && !inited) {
      setName(template.name)
      setRows(template.exercises.map((e) => ({ ...e, uid: generateId() })))
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

  function addExercise(ex: Exercise) {
    setRows((rs) => [
      ...rs,
      {
        uid: generateId(),
        exerciseId: ex.id,
        exerciseName: ex.name,
        order: rs.length,
        defaultSets: 3,
        defaultReps: 10,
        defaultRestSeconds: 90,
      },
    ])
    setDirty(true)
  }

  async function save() {
    if (!template) return
    try {
      await upsertTemplate({
        id: template.id,
        name: name.trim() || template.name,
        type: template.type,
        tags: template.tags,
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
        cardioActivity: template.cardioActivity,
        targetDurationSeconds: template.targetDurationSeconds,
        targetDistanceKm: template.targetDistanceKm,
        intervals: template.intervals,
        lastUsedAt: template.lastUsedAt,
      })
      toast.success('Saved')
      navigate(`/library/${template.id}`)
    } catch {
      toast.error('Could not save template')
    }
  }

  function cancel() {
    if (dirty) setConfirmCancel(true)
    else navigate(`/library/${id}`)
  }

  const isStrength = template?.type === 'strength'

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

        {isStrength ? (
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
        ) : (
          <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
            Cardio targets and intervals aren’t editable in v1 — name and tags are saved.
          </p>
        )}
      </div>

      <ExercisePicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={addExercise} />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Your edits will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(`/library/${id}`)}>Discard</AlertDialogAction>
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
