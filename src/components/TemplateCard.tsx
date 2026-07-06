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
  if (t.type === 'strength' || t.type === 'mixed') {
    // A73/F43 — a mixed (training) template may carry hangboard sets as well as
    // exercises; count both so a hang-only template doesn't read "0 exercises".
    const exs = t.exercises.length
    const hangs = t.hangboardSets?.length ?? 0
    const parts = [
      exs ? `${exs} exercise${exs === 1 ? '' : 's'}` : null,
      hangs ? `${hangs} hang${hangs === 1 ? '' : 's'}` : null,
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : 'No exercises'
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
}

// A77 — tap opens the template. Deletion moved into the edit screen, so there is
// no longer a press-and-hold-to-delete gesture here (it caused accidental
// deletions from a misplaced long-press).
export function TemplateCard({ template, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left text-card-foreground transition-colors active:bg-accent"
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
    </button>
  )
}
