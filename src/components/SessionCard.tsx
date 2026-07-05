import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { DisciplineBadge } from './DisciplineBadge'
import { badgesForSession, type SessionKind } from '@/lib/badges'
import { formatRelativeDay } from '@/lib/date'
import { formatWorkoutLength, workoutDurationSeconds } from '@/lib/formatDuration'
import type { WorkoutSession } from '@/types'

interface Props {
  session: WorkoutSession
  /** Logged-content classification for the subtype emoji (from describeSessions). */
  kind?: SessionKind
  /** Optional primary stat (e.g. "1,240 kg", "5.2 km", "V5 hardest"). */
  stat?: string
}

export function SessionCard({ session, kind, stat }: Props) {
  const inProgress = session.endedAt == null
  const durationSeconds = inProgress ? undefined : workoutDurationSeconds(session)

  // Climbing sessions surface their venue name (gym / crag / board) when set.
  const locationName =
    session.type === 'climbing'
      ? (session.climbingVenue === 'gym'
          ? session.gym
          : session.climbingVenue === 'crag'
            ? session.crag
            : session.climbingVenue === 'home'
              ? session.board
              : undefined
        )?.trim() || undefined
      : undefined
  const title = locationName ?? session.templateName

  // A finished session opens its history detail; an in-progress one links back
  // to the live screen so it can be resumed and finished (otherwise it would
  // never reach History).
  const to = inProgress ? `/session/${session.type}/${session.id}` : `/history/${session.id}`

  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground transition-colors active:bg-accent"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {badgesForSession(session, kind).map((b, i) => (
            <DisciplineBadge key={i} badge={b} />
          ))}
          <span className="truncate font-medium">{title}</span>
        </div>
        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span>{formatRelativeDay(session.startedAt)}</span>
          {durationSeconds != null && <span>· {formatWorkoutLength(durationSeconds)}</span>}
          {inProgress && <span className="text-amber-400">· In progress</span>}
          {stat && <span>· {stat}</span>}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}
