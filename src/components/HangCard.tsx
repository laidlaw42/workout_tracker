import { Check, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SetCountdown } from '@/components/SetCountdown'
import type { HangboardSet } from '@/types'

interface Props {
  hangSet: HangboardSet
  completedCount: number
  isCurrent: boolean
  skipped: boolean
  onAddSet: () => void
  /** Remove the current incomplete hang (last one → confirms hang removal). */
  onRemoveSet?: () => void
  /** Start the hang countdown (session logs it + starts rest at zero). */
  onStartCountdown?: () => void
  countdown?: { remaining: number; duration: number; precount?: boolean } | null
}

function weightLabel(kg: number): string {
  if (kg === 0) return 'bodyweight'
  return `${kg > 0 ? '+' : ''}${kg} kg`
}

// Body of a hang card. The shell (border, drag handle, long-press Skip/Remove)
// is provided by SortableList.
export function HangCard({
  hangSet,
  completedCount,
  isCurrent,
  skipped,
  onAddSet,
  onRemoveSet,
  onStartCountdown,
  countdown,
}: Props) {
  const complete = completedCount >= hangSet.sets
  const currentHang = completedCount + 1

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{hangSet.gripType}</p>
          <p className="text-xs text-muted-foreground">
            {hangSet.edgeDepthMm}mm · {hangSet.durationSeconds}s · {weightLabel(hangSet.weightKg)}
          </p>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {skipped ? 'Skipped' : complete ? 'Done' : `Hang ${currentHang} of ${hangSet.sets}`}
        </span>
      </div>

      {!skipped && (
        <div className="space-y-2">
          {Array.from({ length: completedCount }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300"
            >
              <Check className="size-4 shrink-0" />
              <span className="text-muted-foreground">Hang {i + 1}</span>
              <span className="font-medium text-foreground">
                {hangSet.durationSeconds}s · {weightLabel(hangSet.weightKg)}
              </span>
            </div>
          ))}

          {isCurrent &&
            !complete &&
            (countdown ? (
              <SetCountdown
                remaining={countdown.remaining}
                duration={countdown.duration}
                label={countdown.precount ? 'Get ready' : 'Hang'}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Button className="flex-1" onClick={onStartCountdown}>
                  Start hang {currentHang} ({hangSet.durationSeconds}s)
                </Button>
                {onRemoveSet && (
                  <button
                    type="button"
                    aria-label="Remove hang"
                    onClick={onRemoveSet}
                    className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors active:bg-accent"
                  >
                    <Minus className="size-4" />
                  </button>
                )}
              </div>
            ))}

          <button
            type="button"
            onClick={onAddSet}
            className="flex items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-muted-foreground transition-colors active:bg-accent"
          >
            <Plus className="size-3.5" /> Add hang
          </button>
        </div>
      )}
    </div>
  )
}
