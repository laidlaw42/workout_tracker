import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, Dumbbell, Flame, Mountain, Settings } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import { createSession, getAllSessions } from '@/db/helpers'
import { computeStreak } from '@/lib/streak'
import { formatLongDate, greeting } from '@/lib/date'
import { cn } from '@/lib/utils'
import { SessionCard } from '@/components/SessionCard'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'

export default function HomeScreen() {
  const navigate = useNavigate()
  const sessions = useLiveQuery(() => getAllSessions(), [])
  const loading = sessions === undefined
  const streak = sessions ? computeStreak(sessions) : 0
  const recent = sessions?.slice(0, 5) ?? []

  async function startClimbing() {
    try {
      const id = await createSession({
        type: 'climbing',
        templateName: 'Climbing session',
        startedAt: Date.now(),
        modifiedFromTemplate: false,
      })
      navigate(`/session/climbing/${id}`)
    } catch {
      toast.error('Could not start climbing session')
    }
  }

  return (
    <div className="space-y-6 p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{formatLongDate()}</p>
          <h1 className="text-2xl font-bold">{greeting()}</h1>
        </div>
        <Link
          to="/settings"
          aria-label="Settings"
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-accent"
        >
          <Settings className="size-5" aria-hidden />
        </Link>
      </header>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
          <Flame className="size-5" aria-hidden />
        </div>
        <div>
          <p className="text-lg font-semibold leading-none">
            {streak} day{streak === 1 ? '' : 's'}
          </p>
          <p className="text-sm text-muted-foreground">
            {streak > 0 ? 'Current streak — keep it going' : 'Start a streak today'}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Quick start</h2>
        <div className="grid grid-cols-3 gap-3">
          <QuickStart
            label="Strength"
            icon={Dumbbell}
            className="bg-teal-500/15 text-teal-300"
            onClick={() => navigate('/library?type=strength')}
          />
          <QuickStart
            label="Cardio"
            icon={Activity}
            className="bg-orange-500/15 text-orange-300"
            onClick={() => navigate('/library?type=cardio')}
          />
          <QuickStart
            label="Climbing"
            icon={Mountain}
            className="bg-green-500/15 text-green-300"
            onClick={startClimbing}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Recent workouts</h2>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="No workouts yet"
            subtitle="Start one from the buttons above."
          />
        ) : (
          <div className="space-y-2">
            {recent.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

interface QuickStartProps {
  label: string
  icon: typeof Dumbbell
  className: string
  onClick: () => void
}

function QuickStart({ label, icon: Icon, className, onClick }: QuickStartProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border p-3 text-sm font-medium transition-transform active:scale-95',
        className,
      )}
    >
      <Icon className="size-6" aria-hidden />
      {label}
    </button>
  )
}
