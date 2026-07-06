import { Fragment, useState } from 'react'
import { Clock } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { describeSessions, getAllSessions } from '@/db/helpers'
import { SegmentedControl } from '@/components/SegmentedControl'
import { SessionCard } from '@/components/SessionCard'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMonthYear } from '@/lib/date'

// A73: two top-level session categories. Training covers strength, cardio, rehab
// and hangboard (all non-climbing types, including 'mixed'); Climbing is the
// route-logging Gym/Crag/Board sessions.
type Filter = 'all' | 'training' | 'climbing'

const OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'training', label: 'Training' },
  { value: 'climbing', label: 'Climbing' },
]

export default function HistoryScreen() {
  const [filter, setFilter] = useState<Filter>('all')
  const data = useLiveQuery(async () => {
    const all = await getAllSessions()
    const sessions = all.filter((s) =>
      filter === 'all' ? true : filter === 'climbing' ? s.type === 'climbing' : s.type !== 'climbing',
    )
    // Completed sessions only, already sorted by startedAt desc.
    const completed = sessions.filter((s) => s.endedAt != null)
    const kinds = await describeSessions(completed)
    return { completed, kinds }
  }, [filter])

  const completed = data?.completed
  const kinds = data?.kinds ?? {}

  return (
    <div className="space-y-4 p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <h1 className="text-2xl font-bold">History</h1>
      <SegmentedControl options={OPTIONS} value={filter} onChange={setFilter} />

      {completed === undefined ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : completed.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No workouts yet"
          subtitle="Completed sessions will appear here."
        />
      ) : (
        <div className="space-y-2">
          {completed.map((session, i) => {
            const month = formatMonthYear(session.startedAt)
            const prevMonth = i > 0 ? formatMonthYear(completed[i - 1].startedAt) : null
            return (
              <Fragment key={session.id}>
                {month !== prevMonth && (
                  <h2 className="px-1 pt-2 text-sm font-medium text-muted-foreground">{month}</h2>
                )}
                <SessionCard session={session} kind={kinds[session.id]} />
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
