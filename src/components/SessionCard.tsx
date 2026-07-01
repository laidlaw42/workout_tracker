import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { DisciplineBadge } from './DisciplineBadge'
import { formatRelativeDay } from '@/lib/date'
import { formatWorkoutLength } from '@/lib/formatDuration'
import type { WorkoutSession } from '@/types'

interface Props {
  session: WorkoutSession
  /** Optional primary stat (e.g. "1,240 kg", "5.2 km", "V5 hardest"). */
  stat?: string
}

export function SessionCard({ session, stat }: Props) {
  const durationSeconds =
    session.endedAt != null ? (session.endedAt - session.startedAt) / 1000 : undefined

  return (
    <Link
      to={`/history/${session.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground transition-colors active:bg-accent"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <DisciplineBadge type={session.type} />
          <span className="truncate font-medium">{session.templateName}</span>
        </div>
        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span>{formatRelativeDay(session.startedAt)}</span>
          {durationSeconds != null && <span>· {formatWorkoutLength(durationSeconds)}</span>}
          {stat && <span>· {stat}</span>}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}
