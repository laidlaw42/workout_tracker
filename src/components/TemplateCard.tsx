import { useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { DisciplineBadge } from './DisciplineBadge'
import { badgeForTemplate } from '@/lib/badges'
import { formatRelativeDay } from '@/lib/date'
import { formatWorkoutLength } from '@/lib/formatDuration'
import type { WorkoutTemplate } from '@/types'

const ACTIVITY_LABELS: Record<string, string> = {
  run: 'Run',
  ride: 'Ride',
  row: 'Row',
  other: 'Cardio',
}

function summarise(t: WorkoutTemplate): string {
  if (t.type === 'strength') {
    const n = t.exercises.length
    return `${n} exercise${n === 1 ? '' : 's'}`
  }
  if (t.type === 'climbing') {
    const hangs = t.hangboardSets?.length ?? 0
    const exs = t.exercises.length
    if (t.climbingKind === 'hangboard') return `Hangboard · ${hangs} grip${hangs === 1 ? '' : 's'}`
    const parts = [
      exs ? `${exs} exercise${exs === 1 ? '' : 's'}` : null,
      hangs ? `${hangs} hang${hangs === 1 ? '' : 's'}` : null,
    ].filter(Boolean)
    return parts.length ? `Climbing · ${parts.join(', ')}` : 'Climbing workout'
  }
  const activity = ACTIVITY_LABELS[t.cardioActivity ?? 'other']
  if (t.intervals?.length) return `${activity} · intervals`
  if (t.targetDurationSeconds) return `${activity} · ${formatWorkoutLength(t.targetDurationSeconds)}`
  if (t.targetDistanceKm) return `${activity} · ${t.targetDistanceKm} km`
  return activity
}

interface Props {
  template: WorkoutTemplate
  onOpen: () => void
  onDelete: () => void
}

// Tap opens the template; press-and-hold (500ms) requests delete.
export function TemplateCard({ template, onOpen, onDelete }: Props) {
  const longPressed = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  const start = () => {
    longPressed.current = false
    timer.current = window.setTimeout(() => {
      longPressed.current = true
      onDelete()
    }, 500)
  }
  const cancel = () => window.clearTimeout(timer.current)

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (!longPressed.current) onOpen()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground transition-colors select-none active:bg-accent"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{template.name}</span>
          <DisciplineBadge badge={badgeForTemplate(template)} />
        </div>
        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span>{summarise(template)}</span>
          <span>· {template.lastUsedAt ? formatRelativeDay(template.lastUsedAt) : 'Never used'}</span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </div>
  )
}
