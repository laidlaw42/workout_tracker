import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, Bandage, Dumbbell, Flame, Hand, Play, Plus, Save, Settings } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import {
  createSession,
  deleteSession,
  describeSessions,
  getAllSessions,
  getUnfinishedSession,
} from '@/db/helpers'
import { runBackup } from '@/lib/backup'
import { computeStreak } from '@/lib/streak'
import { formatLongDate, greeting } from '@/lib/date'
import { getUserName } from '@/lib/userName'
import { cn } from '@/lib/utils'
import { SessionCard } from '@/components/SessionCard'
import { ClimbingQuickStarts } from '@/components/ClimbingQuickStarts'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function HomeScreen() {
  const navigate = useNavigate()
  const data = useLiveQuery(async () => {
    const sessions = await getAllSessions()
    const recent = sessions.slice(0, 5)
    const kinds = await describeSessions(recent)
    return { sessions, recent, kinds }
  }, [])
  const unfinished = useLiveQuery(() => getUnfinishedSession().then((s) => s ?? null), [])
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const loading = data === undefined
  const streak = data ? computeStreak(data.sessions) : 0
  const recent = data?.recent ?? []
  const kinds = data?.kinds ?? {}

  // Back up now — shares the same full-snapshot JSON as Settings → Export data via
  // the OS share sheet (save to Files / iCloud), falling back to a download.
  async function handleBackup() {
    try {
      const result = await runBackup()
      if (!result) return // share sheet cancelled
      if (result.ok) {
        toast.success(result.destination === 'Files' ? 'Backup saved' : 'Backup downloaded')
      } else {
        toast.error(result.detail || 'Backup failed')
      }
    } catch (e) {
      toast.error((e as Error).message || 'Backup failed')
    }
  }

  async function discardUnfinished() {
    if (!unfinished) return
    try {
      await deleteSession(unfinished.id)
      setConfirmDiscard(false)
    } catch {
      toast.error('Could not discard workout')
    }
  }

  // A62 — start a blank strength session with no template and go straight to it;
  // the user builds it up by adding exercises on the empty session screen.
  async function startNewWorkout() {
    try {
      const id = await createSession({
        templateName: 'New workout',
        type: 'strength',
        startedAt: Date.now(),
        modifiedFromTemplate: false,
      })
      navigate(`/session/strength/${id}`)
    } catch {
      toast.error('Could not start workout')
    }
  }

  return (
    <div className="space-y-6 p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{formatLongDate()}</p>
          <h1 className="text-2xl font-bold">
            {greeting()}
            {getUserName() ? `, ${getUserName()}` : ''}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleBackup}
            aria-label="Back up now"
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-accent"
          >
            <Save className="size-5" aria-hidden />
          </button>
          <Link
            to="/settings"
            aria-label="Settings"
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-accent"
          >
            <Settings className="size-5" aria-hidden />
          </Link>
        </div>
      </header>

      {unfinished && (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
          <div className="flex items-start gap-3">
            <Play className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold">Unfinished workout</p>
              <p className="truncate text-sm text-muted-foreground">{unfinished.templateName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => navigate(`/session/${unfinished.type}/${unfinished.id}`)}
            >
              Resume
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => setConfirmDiscard(true)}>
              Discard
            </Button>
          </div>
        </div>
      )}

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

      <Button size="lg" className="w-full" onClick={startNewWorkout}>
        <Plus className="size-5" /> Start new workout
      </Button>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Training</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickStart
            label="Strength"
            icon={Dumbbell}
            className="bg-red-500/15 text-red-300"
            onClick={() => navigate('/library?type=strength')}
          />
          <QuickStart
            label="Cardio"
            icon={Activity}
            className="bg-orange-500/15 text-orange-300"
            onClick={() => navigate('/library?type=cardio')}
          />
          <QuickStart
            label="Rehab"
            icon={Bandage}
            className="bg-sky-500/15 text-sky-300"
            onClick={() => navigate('/library?type=rehab')}
          />
          <QuickStart
            label="Hangboard"
            icon={Hand}
            className="bg-green-500/15 text-green-300"
            onClick={() => navigate('/library?type=hangboard')}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Climbing</h2>
        <ClimbingQuickStarts />
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
              <SessionCard key={s.id} session={s} kind={kinds[s.id]} />
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this workout?</AlertDialogTitle>
            <AlertDialogDescription>All progress will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep workout</AlertDialogCancel>
            <AlertDialogAction onClick={discardUnfinished}>Discard workout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
