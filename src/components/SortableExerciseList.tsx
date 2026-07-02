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
import { GripVertical } from 'lucide-react'
import { ExerciseCard, type LoggedSetInput, type WorkExercise } from '@/components/ExerciseCard'
import type { LoggedSet } from '@/types'

interface Props {
  work: WorkExercise[]
  loggedFor: (ex: WorkExercise) => LoggedSet[]
  isComplete: (ex: WorkExercise) => boolean
  currentUid?: string
  prefillWeight?: number
  onLog: (ex: WorkExercise, data: LoggedSetInput) => void
  onAddSet: (uid: string) => void
  onSkip: (uid: string) => void
  onRemove: (uid: string) => void
  onSwap: () => void
  /** Receives the reordered uids of the *incomplete* exercises. */
  onReorder: (orderedActiveUids: string[]) => void
}

// Completed/skipped exercises are pinned at the top and cannot be dragged; only
// the not-yet-finished exercises are reorderable (F3).
export function SortableExerciseList({
  work,
  loggedFor,
  isComplete,
  currentUid,
  prefillWeight,
  onLog,
  onAddSet,
  onSkip,
  onRemove,
  onSwap,
  onReorder,
}: Props) {
  const fixed = work.filter((e) => isComplete(e))
  const active = work.filter((e) => !isComplete(e))
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function onDragEnd({ active: a, over }: DragEndEvent) {
    if (over && a.id !== over.id) {
      const from = active.findIndex((e) => e.uid === a.id)
      const to = active.findIndex((e) => e.uid === over.id)
      if (from !== -1 && to !== -1) onReorder(arrayMove(active, from, to).map((e) => e.uid))
    }
  }

  return (
    <div className="space-y-3">
      {fixed.map((ex) => (
        <ExerciseCard
          key={ex.uid}
          exercise={ex}
          loggedSets={loggedFor(ex)}
          isCurrent={false}
          onLog={(d) => onLog(ex, d)}
          onAddSet={() => onAddSet(ex.uid)}
          onSkip={() => onSkip(ex.uid)}
          onRemove={() => onRemove(ex.uid)}
        />
      ))}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={active.map((e) => e.uid)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {active.map((ex) => (
              <SortableCard
                key={ex.uid}
                ex={ex}
                loggedSets={loggedFor(ex)}
                isCurrent={ex.uid === currentUid}
                prefillWeight={ex.uid === currentUid ? prefillWeight : undefined}
                draggable={active.length > 1}
                onLog={(d) => onLog(ex, d)}
                onAddSet={() => onAddSet(ex.uid)}
                onSkip={() => onSkip(ex.uid)}
                onRemove={() => onRemove(ex.uid)}
                onSwap={ex.uid === currentUid ? onSwap : undefined}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

interface SortableCardProps {
  ex: WorkExercise
  loggedSets: LoggedSet[]
  isCurrent: boolean
  prefillWeight?: number
  draggable: boolean
  onLog: (data: LoggedSetInput) => void
  onAddSet: () => void
  onSkip: () => void
  onRemove: () => void
  onSwap?: () => void
}

function SortableCard({ ex, draggable, ...rest }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ex.uid,
    disabled: !draggable,
  })
  const handle = draggable ? (
    <button
      type="button"
      aria-label="Drag to reorder"
      className="flex w-6 shrink-0 touch-none items-center justify-center self-stretch rounded-md text-muted-foreground"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-5" />
    </button>
  ) : undefined
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 opacity-70' : ''}
    >
      <ExerciseCard exercise={ex} dragHandle={handle} {...rest} />
    </div>
  )
}
