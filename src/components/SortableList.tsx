import { type ReactNode } from 'react'
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
import { GripVertical, SkipForward, Trash2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'

interface SortableListProps<T> {
  items: T[]
  getUid: (t: T) => string
  isComplete: (t: T) => boolean
  isDimmed?: (t: T) => boolean
  currentUid?: string
  canSkip?: (t: T) => boolean
  skipLabel?: string
  removeLabel?: string
  onReorder: (orderedActiveUids: string[]) => void
  onSkip: (uid: string) => void
  onRemove: (uid: string) => void
  renderItem: (t: T, isCurrent: boolean) => ReactNode
}

// Shared list for the active session: completed/skipped items are pinned at the
// top (non-draggable); not-yet-finished items are reorderable. Each card gets a
// drag handle and a long-press Skip/Remove context menu. Used for both exercises
// and hangboard sets so the logic lives in one place (F3/F4/F5/F10).
export function SortableList<T>({
  items,
  getUid,
  isComplete,
  isDimmed,
  currentUid,
  canSkip,
  skipLabel = 'Skip exercise',
  removeLabel = 'Remove exercise',
  onReorder,
  onSkip,
  onRemove,
  renderItem,
}: SortableListProps<T>) {
  const fixed = items.filter((t) => isComplete(t))
  const active = items.filter((t) => !isComplete(t))
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function onDragEnd({ active: a, over }: DragEndEvent) {
    if (over && a.id !== over.id) {
      const from = active.findIndex((t) => getUid(t) === a.id)
      const to = active.findIndex((t) => getUid(t) === over.id)
      if (from !== -1 && to !== -1) onReorder(arrayMove(active, from, to).map(getUid))
    }
  }

  const shellFor = (t: T) => ({
    isCurrent: getUid(t) === currentUid,
    dimmed: isDimmed?.(t) ?? false,
    canSkip: canSkip ? canSkip(t) : !isComplete(t),
    skipLabel,
    removeLabel,
    onSkip: () => onSkip(getUid(t)),
    onRemove: () => onRemove(getUid(t)),
  })

  return (
    <div className="space-y-3">
      {fixed.map((t) => (
        <Shell key={getUid(t)} {...shellFor(t)}>
          {renderItem(t, false)}
        </Shell>
      ))}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={active.map(getUid)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {active.map((t) => (
              <SortableShell
                key={getUid(t)}
                uid={getUid(t)}
                draggable={active.length > 1}
                {...shellFor(t)}
              >
                {renderItem(t, getUid(t) === currentUid)}
              </SortableShell>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

interface ShellProps {
  isCurrent: boolean
  dimmed: boolean
  canSkip: boolean
  skipLabel: string
  removeLabel: string
  onSkip: () => void
  onRemove: () => void
  children: ReactNode
  dragHandle?: ReactNode
}

function Shell({
  isCurrent,
  dimmed,
  canSkip,
  skipLabel,
  removeLabel,
  onSkip,
  onRemove,
  children,
  dragHandle,
}: ShellProps) {
  return (
    <div
      className={cn(
        'flex gap-2 rounded-2xl border p-3 transition-colors',
        dimmed
          ? 'border-border bg-muted/30 opacity-60'
          : isCurrent
            ? 'border-primary/40 bg-card'
            : 'border-border bg-card',
      )}
    >
      {dragHandle}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="min-w-0 flex-1">{children}</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {canSkip && (
            <ContextMenuItem onSelect={onSkip}>
              <SkipForward /> {skipLabel}
            </ContextMenuItem>
          )}
          <ContextMenuItem variant="destructive" onSelect={onRemove}>
            <Trash2 /> {removeLabel}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}

function SortableShell({
  uid,
  draggable,
  ...rest
}: ShellProps & { uid: string; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: uid,
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
      <Shell {...rest} dragHandle={handle} />
    </div>
  )
}
