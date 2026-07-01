import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from '@/hooks/useDb'
import {
  getCardioForSession,
  getRoutesForSession,
  getSessionById,
  getSetsForSession,
} from '@/db/helpers'
import { PageHeader } from '@/components/PageHeader'
import { RouteCard } from '@/components/RouteCard'
import { DisciplineBadge } from '@/components/DisciplineBadge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { formatPace, formatWorkoutLength } from '@/lib/formatDuration'
import type { ClimbingRoute, LoggedCardio, LoggedSet, WorkoutSession } from '@/types'

function fullDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function SessionDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const session = useLiveQuery(() => getSessionById(id).then((s) => s ?? null), [id])
  const sets = useLiveQuery(() => getSetsForSession(id), [id]) ?? []
  const cardio = useLiveQuery(() => getCardioForSession(id), [id])
  const routes = useLiveQuery(() => getRoutesForSession(id), [id]) ?? []

  if (session === undefined) {
    return (
      <div className="min-h-dvh">
        <PageHeader title="Session" onBack={() => navigate('/history')} />
        <div className="space-y-2 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }
  if (session === null) {
    return (
      <div className="min-h-dvh">
        <PageHeader title="Not found" onBack={() => navigate('/history')} />
        <p className="p-4 text-muted-foreground">This session no longer exists.</p>
      </div>
    )
  }

  const durationSeconds =
    session.endedAt != null ? (session.endedAt - session.startedAt) / 1000 : 0

  return (
    <div className="min-h-dvh pb-6">
      <PageHeader title={session.templateName} onBack={() => navigate('/history')} />
      <div className="space-y-5 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DisciplineBadge type={session.type} />
          <span>{fullDate(session.startedAt)}</span>
          <span>· {formatWorkoutLength(durationSeconds)}</span>
        </div>

        {session.type === 'strength' && <StrengthDetail sets={sets} />}
        {session.type === 'cardio' && <CardioDetail cardio={cardio} />}
        {session.type === 'climbing' && <ClimbingDetail session={session} routes={routes} />}

        {session.notes && (
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-sm font-medium text-muted-foreground">Notes</p>
            <p className="text-sm">{session.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StrengthDetail({ sets }: { sets: LoggedSet[] }) {
  const volume = sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.actualReps ?? 0), 0)
  const groups = new Map<string, LoggedSet[]>()
  for (const s of sets) {
    const arr = groups.get(s.exerciseName) ?? []
    arr.push(s)
    groups.set(s.exerciseName, arr)
  }

  if (sets.length === 0) {
    return <p className="text-sm text-muted-foreground">No sets were logged.</p>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Total sets" value={sets.length} />
        <Stat label="Volume" value={`${Math.round(volume)} kg`} />
      </div>
      <Accordion type="multiple" className="w-full">
        {[...groups.entries()].map(([name, exSets]) => (
          <AccordionItem key={name} value={name}>
            <AccordionTrigger className="text-sm">
              <span className="flex-1 text-left">{name}</span>
              <span className="mr-2 text-muted-foreground">{exSets.length} sets</span>
            </AccordionTrigger>
            <AccordionContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-1 text-left font-normal">Set</th>
                    <th className="py-1 text-left font-normal">Weight</th>
                    <th className="py-1 text-left font-normal">Reps</th>
                  </tr>
                </thead>
                <tbody>
                  {exSets.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="py-1.5">{s.setNumber}</td>
                      <td className="py-1.5">{s.weightKg != null ? `${s.weightKg} kg` : 'BW'}</td>
                      <td className="py-1.5">{s.actualReps ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

function CardioDetail({ cardio }: { cardio: LoggedCardio | undefined }) {
  if (!cardio) return <p className="text-sm text-muted-foreground">No cardio was recorded.</p>
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
        <div>
          <p className="mb-1 text-sm font-medium text-muted-foreground">Interval splits</p>
          <table className="w-full text-sm">
            <tbody>
              {cardio.intervals.map((iv, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1.5">{iv.label}</td>
                  <td className="py-1.5 text-right text-muted-foreground tabular-nums">
                    {iv.durationSeconds}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ClimbingDetail({
  session,
  routes,
}: {
  session: WorkoutSession
  routes: ClimbingRoute[]
}) {
  return (
    <div className="space-y-4">
      {(session.gym || session.crag) && (
        <p className="text-sm text-muted-foreground">
          {[session.gym, session.crag].filter(Boolean).join(' · ')}
        </p>
      )}
      <Stat label="Routes logged" value={routes.length} />
      {routes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No routes were logged.</p>
      ) : (
        <div className="space-y-2">
          {routes.map((r) => (
            <RouteCard key={r.id} route={r} />
          ))}
        </div>
      )}
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
