import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useLiveQuery } from '@/hooks/useDb'
import { getTemplate, startSessionFromTemplate } from '@/db/helpers'
import { DisciplineBadge } from '@/components/DisciplineBadge'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatElapsed, formatWorkoutLength } from '@/lib/formatDuration'
import type { TemplateExercise, WorkoutTemplate } from '@/types'

function setsLabel(ex: TemplateExercise): string {
  const rep =
    ex.defaultReps != null
      ? `${ex.defaultReps}`
      : ex.defaultDuration != null
        ? `${ex.defaultDuration}s`
        : '—'
  return `${ex.defaultSets} × ${rep} · ${ex.defaultRestSeconds}s rest`
}

const ACTIVITY_LABELS: Record<string, string> = {
  run: 'Run',
  ride: 'Ride',
  row: 'Row',
  other: 'Cardio',
}

export default function TemplateDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const template = useLiveQuery(() => getTemplate(id).then((t) => t ?? null), [id])

  async function start(t: WorkoutTemplate) {
    try {
      const res = await startSessionFromTemplate(t.id)
      if (!res) {
        toast.error('Could not start workout')
        return
      }
      navigate(`/session/${res.type}/${res.sessionId}`)
    } catch {
      toast.error('Could not start workout')
    }
  }

  if (template === undefined) {
    return (
      <div className="min-h-dvh">
        <PageHeader title="Template" onBack={() => navigate('/library')} />
        <div className="space-y-2 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    )
  }

  if (template === null) {
    return (
      <div className="min-h-dvh">
        <PageHeader title="Not found" onBack={() => navigate('/library')} />
        <p className="p-4 text-muted-foreground">This template no longer exists.</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-32">
      <PageHeader title={template.name} onBack={() => navigate('/library')} />

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DisciplineBadge type={template.type} />
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        {(template.type === 'strength' ||
          (template.type === 'climbing' && template.climbingKind === 'workout')) && (
          <ol className="space-y-2">
            {template.exercises.map((ex, i) => (
              <li
                key={`${ex.exerciseId}-${i}`}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-border bg-card p-3"
              >
                <span className="font-medium">{ex.exerciseName}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{setsLabel(ex)}</span>
              </li>
            ))}
          </ol>
        )}

        {template.type === 'cardio' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-3 text-sm">
              <p className="font-medium">{ACTIVITY_LABELS[template.cardioActivity ?? 'other']}</p>
              {template.targetDurationSeconds != null && (
                <p className="text-muted-foreground">
                  Target: {formatWorkoutLength(template.targetDurationSeconds)}
                </p>
              )}
              {template.targetDistanceKm != null && (
                <p className="text-muted-foreground">Target: {template.targetDistanceKm} km</p>
              )}
            </div>

            {template.intervals?.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Intervals</p>
                {template.intervals.map((block, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-3 text-sm">
                    {block.repeat > 1 && (
                      <span className="mr-2 font-semibold text-foreground">{block.repeat}×</span>
                    )}
                    {block.steps.map((s, j) => (
                      <span key={j} className="text-muted-foreground">
                        {j > 0 && ' / '}
                        {s.label} {formatElapsed(s.durationSeconds)}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {template.type === 'climbing' && (template.hangboardSets?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Hangboard</p>
            {template.hangboardSets!.map((h) => (
              <div key={h.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{h.gripType}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {h.sets} × {h.durationSeconds}s
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {h.edgeDepthMm}mm edge · {h.weightKg >= 0 ? '+' : ''}
                  {h.weightKg}kg · {h.restSeconds}s rest
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md gap-3 border-t border-border bg-background p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <Button className="flex-1" size="lg" onClick={() => start(template)}>
          Start workout
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => navigate(`/library/${template.id}/edit`)}
        >
          Edit
        </Button>
      </div>
    </div>
  )
}
