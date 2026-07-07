import { cn } from '@/lib/utils'

// A97 — the three timer phases each get a distinct colour: pre-count orange,
// active hold/hang green, an (Abrahang intra-set) rest red. The number, label and
// progress bar all share the phase colour. Theme-adaptive (a darker shade in
// light themes, lighter in dark) so it reads on every theme's background.
export type CountdownPhase = 'precount' | 'hold' | 'rest'

const PHASE_TEXT: Record<CountdownPhase, string> = {
  precount: 'text-orange-500 dark:text-orange-400',
  hold: 'text-green-600 dark:text-green-400',
  rest: 'text-red-500 dark:text-red-400',
}
const PHASE_BAR: Record<CountdownPhase, string> = {
  precount: 'bg-orange-500 dark:bg-orange-400',
  hold: 'bg-green-600 dark:bg-green-400',
  rest: 'bg-red-500 dark:bg-red-400',
}

interface Props {
  remaining: number
  duration: number
  label?: string
  /** Drives the phase colour (A97). Defaults to the active-hold green. */
  phase?: CountdownPhase
}

// Inline countdown shown in place of a timed set's input while running.
// Styled like the rest timer (big dominant number), coloured by phase.
export function SetCountdown({ remaining, duration, label = 'Hold', phase = 'hold' }: Props) {
  const progress = duration > 0 ? remaining / duration : 0
  return (
    <div className="rounded-lg border border-primary/40 bg-background p-3">
      <p className={cn('text-xs font-medium', PHASE_TEXT[phase])}>{label}</p>
      <p
        className={cn(
          'font-mono text-6xl font-bold leading-none tabular-nums',
          PHASE_TEXT[phase],
        )}
      >
        {remaining}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', PHASE_BAR[phase])}
          style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, transition: 'width 0.15s linear' }}
        />
      </div>
    </div>
  )
}
