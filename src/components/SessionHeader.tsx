import { Pause, Play, Trash2, X } from 'lucide-react'
import { formatElapsed } from '@/lib/formatDuration'
import { Button } from '@/components/ui/button'

interface Props {
  title: string
  elapsedSeconds: number
  paused: boolean
  onPause: () => void
  onResume: () => void
  onFinish: () => void
  /** Close the session screen and return home; the session keeps running and
   *  stays resumable (no data is discarded). */
  onClose: () => void
  /** Discard the session (the caller confirms first). */
  onDelete: () => void
  finishLabel?: string
}

export function SessionHeader({
  title,
  elapsedSeconds,
  paused,
  onPause,
  onResume,
  onFinish,
  onClose,
  onDelete,
  finishLabel = 'Finish',
}: Props) {
  return (
    <header className="sticky top-0 z-40 flex min-h-14 items-center gap-2 border-b border-border bg-background/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
      {/* Close — leaves the session running and returns home; it stays resumable
          from the home screen. Neutral, so it never reads as destructive. */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Close workout"
        className="shrink-0 rounded-full text-muted-foreground hover:bg-accent"
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

      {/* Delete — discards the session (confirmed first). Destructive tint, and
          separated from Finish by the Pause control so it isn't fat-fingered. */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label="Delete workout"
        className="shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-5" />
      </Button>

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
