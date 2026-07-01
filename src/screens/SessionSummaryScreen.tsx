import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from '@/hooks/useDb'
import {
  getCardioForSession,
  getPRsForSession,
  getRoutesForSession,
  getSessionById,
  getSetsForSession,
} from '@/db/helpers'
import { DisciplineBadge } from '@/components/DisciplineBadge'
import { PRBadge } from '@/components/PRBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPace, formatWorkoutLength } from '@/lib/formatDuration'
import {
  isCleanTick,
  tickBadgeClass,
  tickLabel,
  vGradeFromIndex,
  vGradeIndex,
} from '@/lib/climbing'
import { cn } from '@/lib/utils'
import type { ClimbingRoute, LoggedCardio, LoggedSet, PersonalRecord } from '@/types'

export default function SessionSummaryScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const session = useLiveQuery(() => getSessionById(id).then((s) => s ?? null), [id])
  const sets = useLiveQuery(() => getSetsForSession(id), [id]) ?? []
  const cardio = useLiveQuery(() => getCardioForSession(id), [id])
  const routes = useLiveQuery(() => getRoutesForSession(id), [id]) ?? []
  const prs = useLiveQuery(() => getPRsForSession(id), [id]) ?? []

  if (session === undefined) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (session === null) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Session not found.</p>
        <Button onClick={() => navigate('/home')}>Go home</Button>
      </div>
    )
  }

  const durationSeconds =
    session.endedAt != null ? (session.endedAt - session.startedAt) / 1000 : 0

  return (
    <div className="flex min-h-dvh flex-col p-4 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <div className="flex-1 space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-3xl font-bold">Nice work! 🎉</p>
          <div className="flex items-center justify-center gap-2">
            <DisciplineBadge type={session.type} />
            <span className="text-sm text-muted-foreground">
              {formatWorkoutLength(durationSeconds)}
            </span>
          </div>
        </div>

        {prs.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Personal records</h2>
            <div className="space-y-2">
              {prs.map((pr) => (
                <PRBadge key={pr.id} label={prLabel(pr)} />
              ))}
            </div>
          </section>
        )}

        {session.type === 'strength' && <StrengthSummary sets={sets} />}
        {session.type === 'cardio' && <CardioSummary cardio={cardio} />}
        {session.type === 'climbing' && <ClimbingSummary routes={routes} />}
      </div>

      <div className="flex gap-3 pt-6 pb-[env(safe-area-inset-bottom)]">
        <Button className="flex-1" size="lg" onClick={() => navigate('/home')}>
          Done
        </Button>
        <Button variant="outline" size="lg" onClick={() => navigate(`/history/${id}`)}>
          View details
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function StrengthSummary({ sets }: { sets: LoggedSet[] }) {
  const volume = sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.actualReps ?? 0), 0)
  const byExercise = new Map<string, number>()
  for (const s of sets) byExercise.set(s.exerciseName, (byExercise.get(s.exerciseName) ?? 0) + 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Exercises" value={byExercise.size} />
        <Stat label="Sets" value={sets.length} />
        <Stat label="Volume" value={`${Math.round(volume)} kg`} />
      </div>
      {byExercise.size > 0 && (
        <div className="space-y-1">
          {[...byExercise.entries()].map(([name, count]) => (
            <div
              key={name}
              className="flex justify-between rounded-lg bg-card px-3 py-2 text-sm"
            >
              <span className="truncate">{name}</span>
              <span className="text-muted-foreground">
                {count} set{count === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CardioSummary({ cardio }: { cardio: LoggedCardio | undefined }) {
  if (!cardio) return <p className="text-center text-sm text-muted-foreground">No cardio recorded.</p>
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Duration" value={formatWorkoutLength(cardio.durationSeconds)} />
        <Stat label="Distance" value={cardio.distanceKm != null ? `${cardio.distanceKm} km` : '—'} />
        <Stat
          label="Pace"
          value={cardio.avgPaceSecondsPerKm ? formatPace(cardio.avgPaceSecondsPerKm) : '—'}
        />
      </div>
      {cardio.intervals && cardio.intervals.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Interval splits</p>
          {cardio.intervals.map((iv, i) => (
            <div key={i} className="flex justify-between rounded-lg bg-card px-3 py-2 text-sm">
              <span>{iv.label}</span>
              <span className="text-muted-foreground tabular-nums">{iv.durationSeconds}s</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClimbingSummary({ routes }: { routes: ClimbingRoute[] }) {
  const boulder = hardestBoulder(routes)
  const roped = hardestRoped(routes)
  const tickCounts = new Map<ClimbingRoute['tick'], number>()
  for (const r of routes) tickCounts.set(r.tick, (tickCounts.get(r.tick) ?? 0) + 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Routes" value={routes.length} />
        <Stat label="Hardest boulder" value={boulder ? vGradeFromIndex(vGradeIndex(boulder.vGrade!)) : '—'} />
        <Stat label="Hardest roped" value={roped ? roped.ewbanksGrade : '—'} />
      </div>
      {tickCounts.size > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Tick breakdown</p>
          <div className="flex flex-wrap gap-2">
            {[...tickCounts.entries()].map(([tick, count]) => (
              <span
                key={tick}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-semibold',
                  tickBadgeClass(tick),
                )}
              >
                {tickLabel(tick)} × {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function hardestBoulder(routes: ClimbingRoute[]): ClimbingRoute | null {
  const clean = routes.filter((r) => r.style === 'bouldering' && r.vGrade && isCleanTick(r.tick))
  if (clean.length === 0) return null
  return clean.reduce((best, r) => (vGradeIndex(r.vGrade!) > vGradeIndex(best.vGrade!) ? r : best))
}

function hardestRoped(routes: ClimbingRoute[]): ClimbingRoute | null {
  const clean = routes.filter(
    (r) => r.style !== 'bouldering' && r.ewbanksGrade != null && isCleanTick(r.tick),
  )
  if (clean.length === 0) return null
  return clean.reduce((best, r) => (r.ewbanksGrade! > best.ewbanksGrade! ? r : best))
}

function prLabel(pr: PersonalRecord): string {
  switch (pr.prType) {
    case 'weight':
      return `${pr.exerciseName} · ${pr.value} kg`
    case 'reps':
      return `${pr.exerciseName} · ${pr.value} reps`
    case 'distance':
      return `${pr.exerciseName} · ${pr.value} km`
    case 'pace':
      return `${pr.exerciseName} · ${formatPace(pr.value)}`
    case 'grade':
      return `${pr.exerciseName} · ${pr.unit === 'vgrade' ? vGradeFromIndex(pr.value) : pr.value}`
  }
}
