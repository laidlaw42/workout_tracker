import { ArrowLeftRight, Dumbbell, GripVertical, Plus, SkipForward, Trash2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export interface RemainingItem {
  uid: string
  name: string
  isCurrent: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName?: string
  remaining: RemainingItem[]
  onAddSet: () => void
  onSkip: () => void
  onSwap: () => void
  onRemove: () => void
  onAddExercise: () => void
  onReorder: (uids: string[]) => void
}

export function ModifySheet({
  open,
  onOpenChange,
  currentName,
  remaining,
  onAddSet,
  onSkip,
  onSwap,
  onRemove,
  onAddExercise,
  onReorder,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      const from = remaining.findIndex((r) => r.uid === active.id)
      const to = remaining.findIndex((r) => r.uid === over.id)
      onReorder(arrayMove(remaining, from, to).map((r) => r.uid))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Modify workout</SheetTitle>
          <SheetDescription>
            {currentName ? `Current exercise: ${currentName}` : 'Adjust your remaining exercises.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          <Button variant="outline" className="w-full" onClick={onAddExercise}>
            <Dumbbell className="size-4" /> Add exercise to workout
          </Button>

          {currentName && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={onAddSet}>
                <Plus className="size-5" />
                <span className="text-xs">Add set</span>
              </Button>
              <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={onSwap}>
                <ArrowLeftRight className="size-5" />
                <span className="text-xs">Swap</span>
              </Button>
              <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={onSkip}>
                <SkipForward className="size-5" />
                <span className="text-xs">Skip</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-1 py-3 text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="size-5" />
                <span className="text-xs">Remove</span>
              </Button>
            </div>
          )}

          {remaining.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Reorder remaining</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                  items={remaining.map((r) => r.uid)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-1">
                    {remaining.map((item) => (
                      <SortableRow key={item.uid} item={item} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SortableRow({ item }: { item: RemainingItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.uid,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 ${isDragging ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        className="flex size-8 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm">
        {item.name}
        {item.isCurrent && <span className="ml-2 text-xs text-primary">current</span>}
      </span>
    </li>
  )
}
