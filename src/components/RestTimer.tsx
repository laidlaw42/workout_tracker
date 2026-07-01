import { formatElapsed } from '@/lib/formatDuration'
import { Button } from '@/components/ui/button'

interface Props {
  remaining: number
  duration: number
  onSkip: () => void
}

const R = 26
const CIRC = 2 * Math.PI * R

export function RestTimer({ remaining, duration, onSkip }: Props) {
  const done = remaining <= 0
  const progress = duration > 0 ? remaining / duration : 0
  const offset = CIRC * (1 - progress)

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3 shadow-lg">
        <div className="relative flex size-16 shrink-0 items-center justify-center">
          <svg className="size-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
            <circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={offset}
              className={done ? 'text-green-500' : 'text-primary'}
              style={{ transition: 'stroke-dashoffset 0.25s linear' }}
            />
          </svg>
          <span className="absolute font-mono text-sm font-semibold tabular-nums">
            {formatElapsed(remaining)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{done ? 'Rest complete' : 'Rest'}</p>
          <p className="text-sm text-muted-foreground">
            {done ? 'Ready for your next set' : 'Timer running…'}
          </p>
        </div>
        <Button variant="secondary" onClick={onSkip}>
          {done ? 'Dismiss' : 'Skip'}
        </Button>
      </div>
    </div>
  )
}
