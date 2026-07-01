import { formatElapsed } from '@/lib/formatDuration'
import { Button } from '@/components/ui/button'

interface Props {
  title: string
  elapsedSeconds: number
  onFinish: () => void
  finishLabel?: string
}

export function SessionHeader({ title, elapsedSeconds, onFinish, finishLabel = 'Finish' }: Props) {
  return (
    <header className="sticky top-0 z-40 flex min-h-14 items-center gap-3 border-b border-border bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight">{title}</p>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatElapsed(elapsedSeconds)}
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={onFinish}>
        {finishLabel}
      </Button>
    </header>
  )
}
