import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useLiveQuery } from '@/hooks/useDb'
import { useElapsedTimer } from '@/hooks/useElapsedTimer'
import { useIntervalTimer } from '@/hooks/useIntervalTimer'
import {
  addCardio,
  checkAndSavePR,
  endSession,
  getSessionById,
  getTemplate,
  updateSession,
} from '@/db/helpers'
import { SessionHeader } from '@/components/SessionHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatElapsed, formatPace } from '@/lib/formatDuration'
import type { CardioActivityType, CompletedInterval } from '@/types'

const ACTIVITY_LABELS: Record<CardioActivityType, string> = {
  run: 'Run',
  ride: 'Ride',
  row: 'Row',
  other: 'Cardio',
}

export default function CardioSessionScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const session = useLiveQuery(() => getSessionById(id).then((s) => s ?? null), [id])
  const template = useLiveQuery(
    () => (session?.templateId ? getTemplate(session.templateId).then((t) => t ?? null) : null),
    [session?.templateId],
  )

  const [distance, setDistance] = useState('')
  const [notes, setNotes] = useState('')

  const elapsed = useElapsedTimer(session?.startedAt ?? Date.now())
  const timer = useIntervalTimer(template?.intervals ?? [])

  const activity: CardioActivityType = template?.cardioActivity ?? 'other'
  const distanceKm = distance.trim() === '' ? undefined : Number(distance)
  const paceSecPerKm =
    distanceKm && distanceKm > 0 && !Number.isNaN(distanceKm) ? elapsed / distanceKm : undefined

  async function finish() {
    try {
      const intervals: CompletedInterval[] | undefined = timer.hasIntervals
        ? timer.steps.map((s, i) => ({ label: s.label, durationSeconds: s.duration, order: i }))
        : undefined
      await addCardio({
        sessionId: id,
        activityType: activity,
        durationSeconds: elapsed,
        distanceKm: distanceKm != null && !Number.isNaN(distanceKm) ? distanceKm : undefined,
        avgPaceSecondsPerKm: paceSecPerKm ? Math.round(paceSecPerKm) : undefined,
        intervals,
        loggedAt: Date.now(),
      })
      if (notes.trim()) await updateSession(id, { notes: notes.trim() })

      // PR checks (keyed by activity label). checkAndSavePR only persists a beat.
      const label = ACTIVITY_LABELS[activity]
      const validDistance = distanceKm != null && !Number.isNaN(distanceKm) ? distanceKm : undefined
      if (validDistance != null) {
        await checkAndSavePR({
          exerciseName: label,
          prType: 'distance',
          value: validDistance,
          unit: 'km',
          sessionId: id,
          achievedAt: Date.now(),
        })
      }
      if (paceSecPerKm) {
        await checkAndSavePR({
          exerciseName: label,
          prType: 'pace',
          value: Math.round(paceSecPerKm),
          unit: 's/km',
          sessionId: id,
          achievedAt: Date.now(),
        })
      }

      await endSession(id)
      navigate(`/session/${id}/summary`)
    } catch {
      toast.error('Could not finish session')
    }
  }

  if (session === null) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Session not found.</p>
        <Button className="mt-3" onClick={() => navigate('/home')}>
          Go home
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-24">
      <SessionHeader
        title={session?.templateName ?? ACTIVITY_LABELS[activity]}
        elapsedSeconds={elapsed}
        onFinish={finish}
      />

      <div className="space-y-6 p-4">
        <div className="pt-4 text-center">
          <p className="text-sm text-muted-foreground">{ACTIVITY_LABELS[activity]}</p>
          <p className="font-mono text-6xl font-bold tabular-nums">{formatElapsed(elapsed)}</p>
        </div>

        {timer.hasIntervals && (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
            {timer.finished ? (
              <p className="text-center font-semibold text-green-300">Intervals complete</p>
            ) : (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Interval {timer.currentIndex + 1} of {timer.steps.length}
                </p>
                <p className="text-2xl font-bold">{timer.current?.label}</p>
                <p className="font-mono text-4xl font-bold tabular-nums">
                  {formatElapsed(timer.remainingInStep)}
                </p>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-1.5">
              {timer.steps.map((s, i) => (
                <span
                  key={i}
                  title={s.label}
                  className={cn(
                    'size-2.5 rounded-full',
                    i < timer.currentIndex || timer.finished
                      ? 'bg-primary'
                      : i === timer.currentIndex
                        ? 'bg-primary/60 ring-2 ring-primary'
                        : 'bg-muted',
                  )}
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="distance">Distance (km)</Label>
            <Input
              id="distance"
              inputMode="decimal"
              value={distance}
              placeholder="0.0"
              onChange={(e) => setDistance(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </div>
          <div className="space-y-2">
            <Label>Pace</Label>
            <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm">
              {paceSecPerKm ? formatPace(paceSecPerKm) : '—'}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it feel?"
            rows={3}
          />
        </div>

        <Button size="lg" className="w-full" onClick={finish}>
          Finish session
        </Button>
      </div>
    </div>
  )
}
