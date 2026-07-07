import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { useTagColours } from '@/hooks/useTagColours'
import { getTemplate, startSessionFromTemplate } from '@/db/helpers'
import { DisciplineBadge } from '@/components/DisciplineBadge'
import { badgesForTemplate } from '@/lib/badges'
import { templateCategories } from '@/lib/templateCategories'
import { estimateTemplate, formatEstimateRange, formatRowEstimate } from '@/lib/estimateDuration'
import { getPrecountSeconds } from '@/lib/prefs'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatElapsed, formatWorkoutLength } from '@/lib/formatDuration'
import { weightLabel } from '@/lib/climbing'
import { cn } from '@/lib/utils'
import type { HangboardSet, HangType, TemplateExercise, WorkoutTemplate } from '@/types'

function setsLabel(ex: TemplateExercise): string {
  const rep =
    ex.defaultReps != null
      ? `${ex.defaultReps}`
      : ex.defaultDuration != null
        ? `${ex.defaultDuration}s`
        : '—'
  return `${ex.defaultSets} × ${rep} · ${ex.defaultRestSeconds}s rest`
}

const HANG_TYPE_LABELS: Record<HangType, string> = {
  sub_max: 'Sub-max',
  max_hang: 'Max hang',
  abrahang: 'Abrahang',
}

// The protocol line for a hang row. Abrahang shows its rep + work/rest structure;
// other hang types show sets × duration. Never reps (hangs are duration-based).
function hangProtocol(h: HangboardSet): string {
  if ((h.hangType ?? 'sub_max') === 'abrahang') {
    const reps = h.abrahangReps ?? 6
    const intra = h.intraRestSeconds ?? 3
    return `${h.sets} × ${reps} reps (${h.durationSeconds}s on / ${intra}s off) · ${h.restSeconds}s rest`
  }
  return `${h.sets} × ${h.durationSeconds}s · ${h.restSeconds}s rest`
}

const ACTIVITY_LABELS: Record<string, string> = {
  run: 'Run',
  ride: 'Ride',
  row: 'Row',
  other: 'Cardio',
}

// A101 — estimated session duration with a collapsible per-exercise breakdown.
// Reactive: the template comes from a live query, and the pre-count preference is
// read on each render, so edits update the estimate.
function EstimateSection({ template }: { template: WorkoutTemplate }) {
  const [open, setOpen] = useState(false)
  const precount = getPrecountSeconds()
  const estimate = useMemo(() => estimateTemplate(template, precount), [template, precount])

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">Estimated duration (approximate)</p>
        <p className="shrink-0 text-lg font-bold tabular-nums">
          {/* Nothing timed (e.g. distance-only work) can't be estimated — show a
              dash rather than a misleading "< 5 min". */}
          {estimate.totalSeconds > 0 ? formatEstimateRange(estimate.totalSeconds) : '—'}
        </p>
      </div>
      {estimate.hasVaries && (
        <p className="text-xs text-muted-foreground">Distance work isn’t timed and is excluded.</p>
      )}
      {estimate.rows.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center justify-between py-1 text-left text-sm text-muted-foreground"
          >
            <span>Per-exercise breakdown</span>
            <ChevronDown
              aria-hidden
              className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
            />
          </button>
          {open && (
            <ul className="space-y-1">
              {estimate.rows.map((r, i) => (
                <li key={`${r.name}-${i}`} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{r.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatRowEstimate(r.seconds)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default function TemplateDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const template = useLiveQuery(() => getTemplate(id).then((t) => t ?? null), [id])
  const tagColour = useTagColours()

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
          {badgesForTemplate(template).map((b, i) => (
            <DisciplineBadge key={i} badge={b} />
          ))}
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: tagColour(tag) }} />
              {tag}
            </span>
          ))}
        </div>

        {template.exercises.length > 0 && (
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

        {templateCategories(template).includes('cardio') && (
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

        {(template.hangboardSets?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Hangboard</p>
            {template.hangboardSets!.map((h) => (
              <div key={h.id} className="space-y-0.5 rounded-xl border border-border bg-card p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{h.gripType}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {HANG_TYPE_LABELS[h.hangType ?? 'sub_max']}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{hangProtocol(h)}</p>
                <p className="text-xs text-muted-foreground">
                  {h.edgeDepthMm}mm edge · {weightLabel(h.weightKg)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* A101 — estimated session duration for templates with a work structure
            (exercises / hangboard sets). Pure-cardio templates show their target
            directly above, so this is skipped for them. */}
        {(template.exercises.length > 0 || (template.hangboardSets?.length ?? 0) > 0) && (
          <EstimateSection template={template} />
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
          Edit workout
        </Button>
      </div>
    </div>
  )
}
