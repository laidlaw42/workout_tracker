import { formatElapsed } from '@/lib/formatDuration'
import { useCountdownBeeps } from '@/hooks/useCountdownBeeps'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  remaining: number
  duration: number
  paused?: boolean
  onSkip: () => void
}

export function RestTimer({ remaining, duration, paused = false, onSkip }: Props) {
  const done = remaining <= 0
  const progress = duration > 0 ? remaining / duration : 0
  // Beep at 4/3/2/1 and a completion tone at 0 (component only mounts while
  // running). Silent while paused — the countdown is frozen, so nothing sounds.
  useCountdownBeeps(remaining, !paused)

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            {done ? 'Rest complete' : 'Rest'}
            {paused && <span className="ml-1.5 text-amber-400">· Paused</span>}
          </p>
          <Button variant="secondary" onClick={onSkip}>
            {done ? 'Dismiss' : 'Skip'}
          </Button>
        </div>
        <p
          className={cn(
            'mt-1 font-mono text-7xl font-bold leading-none tabular-nums',
            // A97 — rest counts down in red; a completed rest flips to green and a
            // paused one to amber.
            done
              ? 'text-green-500'
              : paused
                ? 'text-amber-400'
                : 'text-red-500 dark:text-red-400',
          )}
        >
          {formatElapsed(remaining)}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full',
              done
                ? 'bg-green-500'
                : paused
                  ? 'bg-amber-400'
                  : 'bg-red-500 dark:bg-red-400',
            )}
            style={{
              width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
              transition: paused ? 'none' : 'width 0.25s linear',
            }}
          />
        </div>
      </div>
    </div>
  )
}
