import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { HangboardSet } from '@/types'

interface Props {
  hangSet: HangboardSet
  completedCount: number
  isCurrent: boolean
  onLog: () => void
}

function weightLabel(kg: number): string {
  if (kg === 0) return 'bodyweight'
  return `${kg > 0 ? '+' : ''}${kg} kg`
}

export function HangCard({ hangSet, completedCount, isCurrent, onLog }: Props) {
  const complete = completedCount >= hangSet.sets
  const currentHang = completedCount + 1

  return (
    <div
      className={cn(
        'space-y-3 rounded-2xl border p-4 transition-colors',
        isCurrent ? 'border-primary/40 bg-card' : 'border-border bg-card',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{hangSet.gripType}</p>
          <p className="text-xs text-muted-foreground">
            {hangSet.edgeDepthMm}mm · {hangSet.durationSeconds}s · {weightLabel(hangSet.weightKg)}
          </p>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {complete ? 'Done' : `Hang ${currentHang} of ${hangSet.sets}`}
        </span>
      </div>

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

        {isCurrent && !complete && (
          <Button className="w-full" onClick={onLog}>
            Log hang {currentHang}
          </Button>
        )}
      </div>
    </div>
  )
}
