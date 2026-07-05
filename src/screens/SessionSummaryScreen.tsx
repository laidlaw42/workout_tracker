import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { useLiveQuery } from '@/hooks/useDb'
import { getConfettiEnabled } from '@/lib/prefs'
import { getTheme, THEME_PREVIEWS } from '@/lib/theme'
import {
  getCardioForSession,
  getHangsForSession,
  getPRsForSession,
  getRoutesForSession,
  getSessionById,
  getSetsForSession,
} from '@/db/helpers'
import { DisciplineBadge } from '@/components/DisciplineBadge'
import { badgeForSession, deriveSessionKind } from '@/lib/badges'
import { PRBadge } from '@/components/PRBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPace, formatWorkoutLength, workoutDurationSeconds } from '@/lib/formatDuration'
import { randomPhrase, randomQuote } from '@/lib/completionMessages'
import {
  isCleanTick,
  tickBadgeClass,
  tickLabel,
  vGradeFromIndex,
  vGradeIndex,
} from '@/lib/climbing'
import { contrastText, gradeToColor, vGradeToColor } from '@/lib/gradeColors'
import { tickIndicator } from '@/lib/tickTypes'
import { useTickDisplayStyle } from '@/hooks/useTickSymbol'
import { cn } from '@/lib/utils'
import type { ClimbingRoute, LoggedCardio, LoggedSet, PersonalRecord } from '@/types'

// canvas-confetti only parses hex colours; theme previews may be oklch (the
// default dark/light themes). Resolve any CSS colour to sRGB hex by painting a
// 1×1 canvas and reading the rendered pixel — robust across colour spaces
// (`getComputedStyle().color` serialises oklch back as oklch in Chromium, so it
// can't be regex-parsed as rgb).
function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return '#ffffff'
  ctx.fillStyle = '#ffffff' // fallback if `color` is unsupported (setter ignores it)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

// One celebratory burst from the top centre in the active theme's primary +
// accent colours (A41). canvas-confetti's default canvas is fixed and
// pointer-events:none, so it never blocks the summary buttons underneath.
function fireCelebration() {
  const [, primary, accent] = THEME_PREVIEWS[getTheme()] ?? THEME_PREVIEWS.dark
  confetti({
    particleCount: 140,
    spread: 75,
    startVelocity: 45,
    ticks: 240,
    origin: { x: 0.5, y: 0 },
    colors: [toHex(primary), toHex(accent)],
    disableForReducedMotion: true,
  })
}

export default function SessionSummaryScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  // Re-randomised on each mount (i.e. each time the summary is shown).
  const [phrase] = useState(randomPhrase)
  const [quote] = useState(randomQuote)

  const session = useLiveQuery(() => getSessionById(id).then((s) => s ?? null), [id])
  const sets = useLiveQuery(() => getSetsForSession(id), [id]) ?? []
  const cardio = useLiveQuery(() => getCardioForSession(id), [id])
  const routes = useLiveQuery(() => getRoutesForSession(id), [id]) ?? []
  const hangs = useLiveQuery(() => getHangsForSession(id), [id]) ?? []
  const prs = useLiveQuery(() => getPRsForSession(id), [id]) ?? []

  // Fire the celebration once, when the session first loads (A41) — unless the
  // user turned it off in Settings.
  const celebratedRef = useRef(false)
  useEffect(() => {
    if (celebratedRef.current || !session) return
    celebratedRef.current = true
    if (getConfettiEnabled()) fireCelebration()
  }, [session])

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

  const durationSeconds = workoutDurationSeconds(session)
  const badge = badgeForSession(
    session,
    deriveSessionKind(session, {
      routes,
      hasHang: hangs.length > 0,
      hasSet: sets.length > 0,
      cardioActivity: cardio?.activityType,
    }),
  )

  return (
    <div className="flex min-h-dvh flex-col p-4 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <div className="flex-1 space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-3xl font-bold">{phrase}</p>
          <div className="flex items-center justify-center gap-2">
            <DisciplineBadge badge={badge} />
            <span className="text-sm text-muted-foreground">
              {formatWorkoutLength(durationSeconds)}
            </span>
          </div>
          <p className="mx-auto max-w-xs text-sm italic text-muted-foreground">“{quote}”</p>
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
        {session.type === 'climbing' && (
          <ClimbingSummary routes={routes} hangCount={hangs.length} setCount={sets.length} />
        )}
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

function gradePill(label: string, color: string): ReactNode {
  return (
    <span
      style={{ backgroundColor: color, color: contrastText(color) }}
      className="inline-flex items-center rounded-md px-2 py-0.5 text-base"
    >
      {label}
    </span>
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

function ClimbingSummary({
  routes,
  hangCount,
  setCount,
}: {
  routes: ClimbingRoute[]
  hangCount: number
  setCount: number
}) {
  const tickStyle = useTickDisplayStyle()
  const boulder = hardestBoulder(routes)
  const roped = hardestRoped(routes)
  const tickCounts = new Map<ClimbingRoute['tick'], number>()
  for (const r of routes) tickCounts.set(r.tick, (tickCounts.get(r.tick) ?? 0) + 1)

  const stats: { label: string; value: ReactNode }[] = []
  if (hangCount > 0) stats.push({ label: 'Hangs', value: hangCount })
  if (setCount > 0) stats.push({ label: 'Sets', value: setCount })
  if (routes.length > 0 || stats.length === 0) stats.push({ label: 'Routes', value: routes.length })
  // Total metres climbed (A44) — only when at least one route logged a height.
  const totalMetres = routes.reduce((sum, r) => sum + (r.heightMetres ?? 0), 0)
  if (totalMetres > 0) stats.push({ label: 'Metres', value: `${Math.round(totalMetres)}m` })
  if (boulder)
    stats.push({ label: 'Hardest V', value: gradePill(boulder.vGrade!, vGradeToColor(boulder.vGrade!)) })
  if (roped)
    stats.push({
      label: 'Hardest Ewb',
      value: gradePill(String(roped.ewbanksGrade), gradeToColor(roped.ewbanksGrade!)),
    })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} />
        ))}
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
                <span aria-hidden className="mr-0.5">
                  {tickIndicator(tick, tickStyle)}
                </span>
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
    case 'duration':
      return `${pr.exerciseName} · ${pr.value}s hang`
  }
}
