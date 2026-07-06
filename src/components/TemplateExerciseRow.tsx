import { GripVertical, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Input } from '@/components/ui/input'
import type { TemplateExercise } from '@/types'

// A template exercise plus a stable ui id for drag/reorder.
export type TemplateRow = TemplateExercise & { uid: string }

interface RowProps {
  row: TemplateRow
  onChange: (patch: Partial<TemplateRow>) => void
  onRemove: () => void
  /** Whether to show the Hold (s) field instead of Reps. Pass the exercise's
   *  tracking type so clearing the value can't flip the field (and lose it);
   *  falls back to whether a duration is currently set. */
  timed?: boolean
}

// One draggable exercise row in a workout builder: sets, reps-or-hold, and rest,
// all editable inline. A duration-tracked exercise shows a Hold (s) field instead
// of Reps. Must be wrapped in a DndContext + SortableContext.
export function TemplateExerciseRow({ row, onChange, onRemove, timed: timedProp }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.uid,
  })
  const timed = timedProp ?? row.defaultDuration != null

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
        <NumField label="Sets" value={row.defaultSets} onChange={(v) => onChange({ defaultSets: v ?? 0 })} />
        {timed ? (
          <NumField
            label="Hold (s)"
            value={row.defaultDuration}
            onChange={(v) => onChange({ defaultDuration: v })}
          />
        ) : (
          <NumField label="Reps" value={row.defaultReps} onChange={(v) => onChange({ defaultReps: v })} />
        )}
        <NumField
          label="Rest (s)"
          value={row.defaultRestSeconds}
          onChange={(v) => onChange({ defaultRestSeconds: v ?? 0 })}
        />
      </div>
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
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
