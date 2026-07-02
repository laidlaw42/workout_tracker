import { Pause, Play, X } from 'lucide-react'
import { formatElapsed } from '@/lib/formatDuration'
import { Button } from '@/components/ui/button'

interface Props {
  title: string
  elapsedSeconds: number
  paused: boolean
  onPause: () => void
  onResume: () => void
  onFinish: () => void
  onCancel: () => void
  finishLabel?: string
}

export function SessionHeader({
  title,
  elapsedSeconds,
  paused,
  onPause,
  onResume,
  onFinish,
  onCancel,
  finishLabel = 'Finish',
}: Props) {
  return (
    <header className="sticky top-0 z-40 flex min-h-14 items-center gap-2 border-b border-border bg-background/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
      {/* Cancel — discards the session; tinted destructive so it never reads
          as the neutral timer control beside it. */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        aria-label="Cancel workout"
        className="shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="size-5" />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight">{title}</p>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatElapsed(elapsedSeconds)}
          {paused && <span className="ml-2 text-amber-400">Paused</span>}
        </p>
      </div>

      {/* Pause / Resume — a filled circle marks it as the timer control. */}
      <Button
        variant="secondary"
        size="icon"
        onClick={paused ? onResume : onPause}
        aria-label={paused ? 'Resume timer' : 'Pause timer'}
        className="shrink-0 rounded-full"
      >
        {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
      </Button>

      {/* Finish — the primary positive action; solid accent pill. */}
      <Button onClick={onFinish} className="shrink-0 rounded-full px-5">
        {finishLabel}
      </Button>
    </header>
  )
}
