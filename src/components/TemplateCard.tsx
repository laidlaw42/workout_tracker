import { ChevronRight, Play } from 'lucide-react'
import { DisciplineBadge } from './DisciplineBadge'
import { FavoriteButton } from './FavoriteButton'
import { InfoButton } from './InfoButton'
import { badgesForTemplate } from '@/lib/badges'
import { templateCategories } from '@/lib/templateCategories'
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
  // A pure cardio template (no exercise rows / hangs) — describe activity + target.
  const exs = t.exercises.length
  const hangs = t.hangboardSets?.length ?? 0
  if (templateCategories(t).includes('cardio') && exs === 0 && hangs === 0) {
    const activity = ACTIVITY_LABELS[t.cardioActivity ?? 'other']
    if (t.intervals?.length) return `${activity} · intervals`
    if (t.targetDurationSeconds) return `${activity} · ${formatWorkoutLength(t.targetDurationSeconds)}`
    if (t.targetDistanceKm) return `${activity} · ${t.targetDistanceKm} km`
    return activity
  }
  // Exercise / hangboard template — count both (A73/F43).
  const parts = [
    exs ? `${exs} exercise${exs === 1 ? '' : 's'}` : null,
    hangs ? `${hangs} hang${hangs === 1 ? '' : 's'}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'No exercises'
}

interface Props {
  template: WorkoutTemplate
  onOpen: () => void
  /** Start the workout straight away (Play button). Omit to hide it. */
  onStart?: () => void
  /** When provided, a heart toggle replaces the chevron (library favourites). */
  onToggleFavorite?: () => void
}

// A77 — tap opens the template. Deletion moved into the edit screen, so there is
// no longer a press-and-hold-to-delete gesture here (it caused accidental
// deletions from a misplaced long-press).
export function TemplateCard({ template, onOpen, onStart, onToggleFavorite }: Props) {
  return (
    <div className="flex items-center rounded-xl border border-border bg-card text-card-foreground">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-l-xl p-3 text-left transition-colors active:bg-accent"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{template.name}</span>
            {/* A94 — one pill per category the template spans. */}
            <span className="flex shrink-0 flex-wrap gap-1">
              {badgesForTemplate(template).map((b, i) => (
                <DisciplineBadge key={i} badge={b} />
              ))}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            <span>{summarise(template)}</span>
            <span>· {template.lastUsedAt ? formatRelativeDay(template.lastUsedAt) : 'Never used'}</span>
          </div>
        </div>
        {!onToggleFavorite && !onStart && (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>
      <InfoButton title={template.name} description={template.notes} />
      {onStart && (
        <button
          type="button"
          aria-label={`Start ${template.name}`}
          onClick={onStart}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-primary transition-colors active:bg-accent"
        >
          <Play className="size-4" />
        </button>
      )}
      {onToggleFavorite && (
        <FavoriteButton
          favorite={!!template.favorite}
          onToggle={onToggleFavorite}
          label={template.name}
          className="mr-1.5"
        />
      )}
    </div>
  )
}
