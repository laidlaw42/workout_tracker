import { ArrowLeftRight, ChevronDown, ChevronUp, Plus, SkipForward } from 'lucide-react'
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
  onMove: (uid: string, dir: -1 | 1) => void
}

export function ModifySheet({
  open,
  onOpenChange,
  currentName,
  remaining,
  onAddSet,
  onSkip,
  onSwap,
  onMove,
}: Props) {
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
          {currentName && (
            <div className="grid grid-cols-3 gap-2">
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
            </div>
          )}

          {remaining.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Reorder remaining</p>
              <ul className="space-y-1">
                {remaining.map((item, i) => (
                  <li
                    key={item.uid}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {item.name}
                      {item.isCurrent && (
                        <span className="ml-2 text-xs text-primary">current</span>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => onMove(item.uid, -1)}
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={i === remaining.length - 1}
                      onClick={() => onMove(item.uid, 1)}
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
