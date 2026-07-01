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
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel workout"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-accent"
      >
        <X className="size-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight">{title}</p>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatElapsed(elapsedSeconds)}
          {paused && <span className="ml-2 text-amber-400">Paused</span>}
        </p>
      </div>

      <button
        type="button"
        onClick={paused ? onResume : onPause}
        aria-label={paused ? 'Resume timer' : 'Pause timer'}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors active:bg-accent"
      >
        {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
      </button>

      <Button size="sm" variant="secondary" onClick={onFinish}>
        {finishLabel}
      </Button>
    </header>
  )
}
