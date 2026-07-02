import { cn } from '@/lib/utils'

interface Props {
  remaining: number
  duration: number
  label?: string
}

// Inline countdown shown in place of a timed set's input while running.
// Styled like the rest timer (big dominant number).
export function SetCountdown({ remaining, duration, label = 'Hold' }: Props) {
  const progress = duration > 0 ? remaining / duration : 0
  return (
    <div className="rounded-lg border border-primary/40 bg-background p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-mono text-6xl font-bold leading-none tabular-nums text-primary">
        {remaining}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full bg-primary')}
          style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, transition: 'width 0.15s linear' }}
        />
      </div>
    </div>
  )
}
