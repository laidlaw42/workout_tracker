import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LineChart as LineIcon } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import {
  getAllExercises,
  getAllHangs,
  getAllRoutes,
  getCardioByActivity,
  getExerciseIdsWithSets,
  getPRsForExercise,
  getSetsForExercise,
} from '@/db/helpers'
import { SegmentedControl } from '@/components/SegmentedControl'
import { EmptyState } from '@/components/EmptyState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { dayKey } from '@/lib/date'
import { formatPace } from '@/lib/formatDuration'
import { CLIMB_CHARACTER_LABEL, isCleanTick, vGradeFromIndex, vGradeIndex } from '@/lib/climbing'
import { gradeToColor, vGradeToColor } from '@/lib/gradeColors'
import type { CardioActivityType, ClimbingRoute, LoggedHang, LoggedSet } from '@/types'

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 11 }
const GOLD = '#f59e0b'

export default function ProgressScreen() {
  return (
    <div className="space-y-4 p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <h1 className="text-2xl font-bold">Progress</h1>
      <Tabs defaultValue="strength">
        <TabsList className="w-full">
          <TabsTrigger value="strength" className="flex-1">
            Strength
          </TabsTrigger>
          <TabsTrigger value="cardio" className="flex-1">
            Cardio
          </TabsTrigger>
          <TabsTrigger value="hangboard" className="flex-1">
            Hangboard
          </TabsTrigger>
          <TabsTrigger value="climbing" className="flex-1">
            Climbing
          </TabsTrigger>
          <TabsTrigger value="rehab" className="flex-1">
            Rehab
          </TabsTrigger>
        </TabsList>
        <TabsContent value="strength" className="pt-4">
          <StrengthTab />
        </TabsContent>
        <TabsContent value="cardio" className="pt-4">
          <CardioTab />
        </TabsContent>
        <TabsContent value="hangboard" className="pt-4">
          <HangboardView />
        </TabsContent>
        <TabsContent value="climbing" className="pt-4">
          <ClimbingTab />
        </TabsContent>
        <TabsContent value="rehab" className="pt-4">
          <RehabTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

// --- Strength ---------------------------------------------------------------

function bestWeightPerDay(sets: LoggedSet[]): { date: string; weight: number }[] {
  const byDay = new Map<string, { ts: number; weight: number }>()
  for (const s of sets) {
    if (s.weightKg == null) continue
    const key = dayKey(s.loggedAt)
    const cur = byDay.get(key)
    if (!cur || s.weightKg > cur.weight) byDay.set(key, { ts: s.loggedAt, weight: s.weightKg })
  }
  return [...byDay.values()]
    .sort((a, b) => a.ts - b.ts)
    .map((d) => ({
      date: new Date(d.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      weight: d.weight,
    }))
}

function StrengthTab() {
  const allExercises = useLiveQuery(() => getAllExercises(), []) ?? []
  const idsWithSets = useLiveQuery(() => getExerciseIdsWithSets(), [])
  // Strength-category exercises with at least one logged set (A36) — cardio is
  // excluded by category, and reps/duration keeps out any distance oddities (F17).
  const loggedIds = useMemo(() => new Set(idsWithSets ?? []), [idsWithSets])
  const exercises = useMemo(
    () =>
      allExercises.filter(
        (e) =>
          e.category === 'strength' &&
          (e.trackingType === 'reps' || e.trackingType === 'duration') &&
          loggedIds.has(e.id),
      ),
    [allExercises, loggedIds],
  )
  const [exerciseId, setExerciseId] = useState<string>('')
  const selected = exercises.find((e) => e.id === exerciseId)
  const sets = useLiveQuery(
    () => (exerciseId ? getSetsForExercise(exerciseId) : Promise.resolve([])),
    [exerciseId],
  )
  const prs = useLiveQuery(
    () => (selected ? getPRsForExercise(selected.name) : Promise.resolve([])),
    [selected?.name],
  )
  const data = bestWeightPerDay(sets ?? [])

  return (
    <div className="space-y-4">
      <Select value={exerciseId} onValueChange={setExerciseId}>
        <SelectTrigger>
          <SelectValue placeholder="Choose an exercise" />
        </SelectTrigger>
        <SelectContent>
          {exercises.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!exerciseId ? (
        <EmptyState icon={LineIcon} title="Pick an exercise" subtitle="See your best weight over time." />
      ) : data.length === 0 ? (
        <EmptyState icon={LineIcon} title="No data yet" subtitle="Log some sets to chart progress." />
      ) : (
        <ChartFrame>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            {/* width 48 fits 3-digit weights + "kg" without clipping (F29). */}
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} unit="kg" />
            <Tooltip
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--popover-foreground)',
              }}
            />
            <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2} dot />
          </LineChart>
        </ChartFrame>
      )}

      {prs && prs.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">PR history</p>
          {prs.map((pr) => (
            <div key={pr.id} className="flex justify-between rounded-lg bg-card px-3 py-2 text-sm">
              <span>{pr.value} {pr.unit}</span>
              <span className="text-muted-foreground">
                {new Date(pr.achievedAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Rehab ------------------------------------------------------------------

// Per-day series for a rehab exercise (A42): max hold for duration moves, max
// weight if any load was used, else total reps that day (volume).
function rehabSeries(
  sets: LoggedSet[],
  metric: 'duration' | 'weight' | 'reps',
): { date: string; value: number }[] {
  const byDay = new Map<string, { ts: number; value: number }>()
  for (const s of sets) {
    if (s.skipped) continue
    const key = dayKey(s.loggedAt)
    const v =
      metric === 'duration' ? (s.durationSeconds ?? 0) : metric === 'weight' ? (s.weightKg ?? 0) : (s.actualReps ?? 0)
    const cur = byDay.get(key)
    if (metric === 'reps') {
      byDay.set(key, { ts: s.loggedAt, value: (cur?.value ?? 0) + v })
    } else if (!cur || v > cur.value) {
      byDay.set(key, { ts: s.loggedAt, value: v })
    }
  }
  return [...byDay.values()]
    .sort((a, b) => a.ts - b.ts)
    .map((d) => ({
      date: new Date(d.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      value: d.value,
    }))
}

// Recovery / prehab work, kept separate from the strength charts (A42).
function RehabTab() {
  const allExercises = useLiveQuery(() => getAllExercises(), []) ?? []
  const idsWithSets = useLiveQuery(() => getExerciseIdsWithSets(), [])
  const loggedIds = useMemo(() => new Set(idsWithSets ?? []), [idsWithSets])
  const exercises = useMemo(
    () => allExercises.filter((e) => e.category === 'rehab' && loggedIds.has(e.id)),
    [allExercises, loggedIds],
  )
  const [exerciseId, setExerciseId] = useState<string>('')
  const selected = exercises.find((e) => e.id === exerciseId)
  const sets = useLiveQuery(
    () => (exerciseId ? getSetsForExercise(exerciseId) : Promise.resolve([])),
    [exerciseId],
  )
  const metric: 'duration' | 'weight' | 'reps' =
    selected?.trackingType === 'duration'
      ? 'duration'
      : (sets ?? []).some((s) => (s.weightKg ?? 0) > 0)
        ? 'weight'
        : 'reps'
  const unit = metric === 'duration' ? 's' : metric === 'weight' ? 'kg' : ''
  const data = rehabSeries(sets ?? [], metric)
  const metricLabel = metric === 'duration' ? 'Longest hold' : metric === 'weight' ? 'Top weight' : 'Total reps'

  return (
    <div className="space-y-4">
      <Select value={exerciseId} onValueChange={setExerciseId}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a rehab exercise" />
        </SelectTrigger>
        <SelectContent>
          {exercises.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {exercises.length === 0 ? (
        <EmptyState icon={LineIcon} title="No rehab logged" subtitle="Log rehab exercises to track recovery work." />
      ) : !exerciseId ? (
        <EmptyState icon={LineIcon} title="Pick an exercise" subtitle="See your recovery trend over time." />
      ) : data.length === 0 ? (
        <EmptyState icon={LineIcon} title="No data yet" subtitle="Log some sets to chart progress." />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{metricLabel} per session</p>
          <ChartFrame>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} unit={unit} />
              <Tooltip
                formatter={(v) => `${Number(v)}${unit ? ' ' + unit : ' reps'}`}
                contentStyle={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--popover-foreground)',
                }}
              />
              <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot />
            </LineChart>
          </ChartFrame>
        </>
      )}
    </div>
  )
}

// --- Cardio -----------------------------------------------------------------

const CARDIO_ACTIVITIES: { value: CardioActivityType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'ride', label: 'Ride' },
  { value: 'row', label: 'Row' },
  { value: 'other', label: 'Other' },
]

function CardioTab() {
  const [activity, setActivity] = useState<CardioActivityType>('run')
  const [metric, setMetric] = useState<'pace' | 'distance'>('pace')
  const cardio = useLiveQuery(() => getCardioByActivity(activity), [activity]) ?? []

  const data = cardio
    .filter((c) => (metric === 'pace' ? c.avgPaceSecondsPerKm != null : c.distanceKm != null))
    .map((c) => ({
      date: new Date(c.loggedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      value: metric === 'pace' ? (c.avgPaceSecondsPerKm ?? 0) : (c.distanceKm ?? 0),
    }))

  return (
    <div className="space-y-4">
      <div className="w-40">
        <Select value={activity} onValueChange={(v) => setActivity(v as CardioActivityType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CARDIO_ACTIVITIES.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SegmentedControl
        options={[
          { value: 'pace', label: 'Pace' },
          { value: 'distance', label: 'Distance' },
        ]}
        value={metric}
        onChange={setMetric}
      />

      {data.length === 0 ? (
        <EmptyState icon={LineIcon} title="No data yet" subtitle="Log some cardio to chart trends." />
      ) : (
        <ChartFrame>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            {/* width 48 fits pace MM:SS ("5:42") without clipping (F29). */}
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) => (metric === 'pace' ? formatPace(v).replace(' /km', '') : String(v))}
            />
            <Tooltip
              formatter={(value) =>
                metric === 'pace' ? formatPace(Number(value)) : `${Number(value)} km`
              }
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--popover-foreground)',
              }}
            />
            <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot />
          </LineChart>
        </ChartFrame>
      )}
    </div>
  )
}

// --- Climbing ---------------------------------------------------------------

interface PyramidRow {
  grade: string
  count: number
  gold: boolean
}

type ClimbGradeMode = 'standard' | 'gym'

// Build a clean-send grade pyramid for one style (bouldering vs roped) in one
// grade mode. Standard mode keys off vGrade (bouldering) or ewbanksGrade (roped);
// gym mode keys off the gym's 0–35 gymGrade. gymGrade is a separate scale that
// isn't comparable to V/Ewbanks, so it gets its own pyramid rather than being
// merged into the V/Ewbanks axis — this is what made gym routes (e.g. gym
// bouldering) vanish from Progress when logged in gym-grade mode (F21).
function buildPyramid(routes: ClimbingRoute[], boulder: boolean, mode: ClimbGradeMode): PyramidRow[] {
  const clean = routes.filter((r) => {
    if (!isCleanTick(r.tick)) return false
    const styleOk = boulder ? r.style === 'bouldering' : r.style !== 'bouldering'
    if (!styleOk) return false
    // Pick whichever grade field is populated for this mode; routes are logged
    // in exactly one mode, so the toggle cleanly partitions them.
    return mode === 'gym' ? r.gymGrade != null : boulder ? !!r.vGrade : r.ewbanksGrade != null
  })
  const byGrade = new Map<number, { count: number; gold: boolean }>()
  for (const r of clean) {
    const key = mode === 'gym' ? r.gymGrade! : boulder ? vGradeIndex(r.vGrade!) : r.ewbanksGrade!
    const cur = byGrade.get(key) ?? { count: 0, gold: false }
    cur.count += 1
    if (r.tick === 'onsight' || r.tick === 'flash') cur.gold = true
    byGrade.set(key, cur)
  }
  return [...byGrade.entries()]
    .sort((a, b) => b[0] - a[0]) // hardest at top
    .map(([key, v]) => ({
      grade: mode === 'gym' ? String(key) : boulder ? vGradeFromIndex(key) : String(key),
      count: v.count,
      gold: v.gold,
    }))
}

// Count occurrences by a derived key, sorted most-frequent first.
function tally<T>(items: T[], key: (t: T) => string | undefined): { label: string; count: number }[] {
  const m = new Map<string, number>()
  for (const it of items) {
    const k = key(it)
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }))
}

function Breakdown({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <span key={i.label} className="rounded-full bg-card px-2.5 py-1 text-xs">
            {i.label} <span className="text-muted-foreground">×{i.count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// Total metres climbed per session (A44) — one point per session that logged at
// least one route height, dated by that session's earliest route.
function metresPerSession(routes: ClimbingRoute[]): { date: string; metres: number }[] {
  const bySession = new Map<string, { ts: number; metres: number }>()
  for (const r of routes) {
    if (r.heightMetres == null) continue
    const cur = bySession.get(r.sessionId)
    if (cur) {
      cur.metres += r.heightMetres
      cur.ts = Math.min(cur.ts, r.loggedAt)
    } else {
      bySession.set(r.sessionId, { ts: r.loggedAt, metres: r.heightMetres })
    }
  }
  return [...bySession.values()]
    .sort((a, b) => a.ts - b.ts)
    .map((s) => ({
      date: new Date(s.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      metres: Math.round(s.metres),
    }))
}

function ClimbingTab() {
  // A73: the Climbing tab is route-only; hangboard progress lives on its own tab.
  const [view, setView] = useState<'boulder' | 'roped'>('boulder')
  const [gradeMode, setGradeMode] = useState<ClimbGradeMode>('standard')
  const routes = useLiveQuery(() => getAllRoutes(), []) ?? []
  const boulder = view === 'boulder'
  // Only surface the Standard/Gym toggle once at least one gym-graded route
  // exists, so users who never use gym grades don't see an empty extra control.
  const hasGymGrades = useMemo(() => routes.some((r) => r.gymGrade != null), [routes])
  // Force Standard whenever the toggle is hidden, so a gradeMode left on 'gym'
  // (e.g. the last gym route was deleted) can't strand an empty pyramid.
  const effectiveMode: ClimbGradeMode = hasGymGrades ? gradeMode : 'standard'
  const data = useMemo(
    () => buildPyramid(routes, boulder, effectiveMode),
    [routes, boulder, effectiveMode],
  )
  // Character (A45) and style (A47) breakdowns, over clean sends.
  const cleanSends = useMemo(() => routes.filter((r) => isCleanTick(r.tick)), [routes])
  const charCounts = useMemo(
    () =>
      tally(cleanSends, (r) => {
        const c = r.climbCharacter ?? r.wallAngle
        return c ? CLIMB_CHARACTER_LABEL[c] : undefined
      }),
    [cleanSends],
  )
  const styleCounts = useMemo(
    () => tally(cleanSends.flatMap((r) => r.climbStyles ?? []), (s) => s),
    [cleanSends],
  )
  // Metres-climbed trend (A44) — only when route heights have been logged.
  const metresData = useMemo(() => metresPerSession(routes), [routes])

  return (
    <div className="space-y-4">
      <SegmentedControl
        options={[
          { value: 'boulder', label: 'Bouldering' },
          { value: 'roped', label: 'Roped' },
        ]}
        value={view}
        onChange={setView}
      />

      {hasGymGrades && (
        <SegmentedControl
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'gym', label: 'Gym grades' },
          ]}
          value={gradeMode}
          onChange={setGradeMode}
        />
      )}

      {data.length === 0 ? (
        <EmptyState icon={LineIcon} title="No sends yet" subtitle="Clean sends build your pyramid." />
      ) : (
        <ChartFrame>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
            <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
            {/* width 44 fits grade labels ("V10", "35") without clipping (F29). */}
            <YAxis
              type="category"
              dataKey="grade"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: 'var(--muted)' }}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--popover-foreground)',
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((row, i) => {
                // Gym grades are not hue-mapped (F25) — render bars in a neutral
                // colour, matching the neutral gym-grade pills elsewhere.
                const color =
                  effectiveMode === 'gym'
                    ? 'var(--muted-foreground)'
                    : boulder
                      ? vGradeToColor(row.grade)
                      : gradeToColor(Number(row.grade))
                // Onsight / flash sends get a gold outline over their grade colour.
                return (
                  <Cell
                    key={i}
                    fill={color}
                    stroke={row.gold ? GOLD : undefined}
                    strokeWidth={row.gold ? 2 : 0}
                  />
                )
              })}
            </Bar>
          </BarChart>
        </ChartFrame>
      )}

      {(charCounts.length > 0 || styleCounts.length > 0) && (
        <div className="space-y-3 pt-1">
          {charCounts.length > 0 && <Breakdown title="Character — clean sends" items={charCounts} />}
          {styleCounts.length > 0 && <Breakdown title="Style — clean sends" items={styleCounts} />}
        </div>
      )}

      {metresData.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-sm font-medium text-muted-foreground">Metres climbed per session</p>
          <ChartFrame>
            <LineChart data={metresData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
              {/* width 44 fits metre totals ("120") without clipping (F29). */}
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => `${v}m`}
              />
              <Tooltip
                formatter={(value) => `${Number(value)} m`}
                contentStyle={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--popover-foreground)',
                }}
              />
              <Line type="monotone" dataKey="metres" stroke="var(--primary)" strokeWidth={2} dot />
            </LineChart>
          </ChartFrame>
        </div>
      )}
    </div>
  )
}

// --- Hangboard --------------------------------------------------------------

function bestHangPerDay(
  hangs: LoggedHang[],
  metric: 'weight' | 'duration',
): { date: string; value: number }[] {
  const byDay = new Map<string, { ts: number; value: number }>()
  for (const h of hangs) {
    const value = metric === 'weight' ? h.weightKg : (h.actualDurationSeconds ?? h.targetDurationSeconds)
    if (value == null) continue
    const key = dayKey(h.loggedAt)
    const cur = byDay.get(key)
    if (!cur || value > cur.value) byDay.set(key, { ts: h.loggedAt, value })
  }
  return [...byDay.values()]
    .sort((a, b) => a.ts - b.ts)
    .map((d) => ({
      date: new Date(d.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      value: d.value,
    }))
}

function HangboardView() {
  const hangs = useLiveQuery(() => getAllHangs(), []) ?? []
  const grips = useMemo(() => [...new Set(hangs.map((h) => h.gripType))].sort(), [hangs])
  const [grip, setGrip] = useState('')
  const [metric, setMetric] = useState<'weight' | 'duration'>('weight')
  const prs =
    useLiveQuery(() => (grip ? getPRsForExercise(grip) : Promise.resolve([])), [grip]) ?? []
  const hangPRs = prs.filter((p) => p.prType === 'weight' || p.prType === 'duration')
  const data = bestHangPerDay(
    hangs.filter((h) => h.gripType === grip),
    metric,
  )
  const unit = metric === 'weight' ? 'kg' : 's'

  if (grips.length === 0) {
    return (
      <EmptyState
        icon={LineIcon}
        title="No hangs yet"
        subtitle="Log a hangboard session to track grip strength."
      />
    )
  }

  return (
    <div className="space-y-4">
      <Select value={grip} onValueChange={setGrip}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a grip" />
        </SelectTrigger>
        <SelectContent>
          {grips.map((g) => (
            <SelectItem key={g} value={g}>
              {g}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <SegmentedControl
        options={[
          { value: 'weight', label: 'Added weight' },
          { value: 'duration', label: 'Hang time' },
        ]}
        value={metric}
        onChange={setMetric}
      />

      {!grip ? (
        <EmptyState icon={LineIcon} title="Pick a grip" subtitle="See your best hang over time." />
      ) : data.length === 0 ? (
        <EmptyState icon={LineIcon} title="No data yet" subtitle="Log some hangs to chart progress." />
      ) : (
        <ChartFrame>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            {/* width 48 fits "120s" / 3-digit weights + unit without clipping (F29). */}
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} unit={unit} />
            <Tooltip
              formatter={(v) => `${Number(v)} ${unit}`}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--popover-foreground)',
              }}
            />
            <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot />
          </LineChart>
        </ChartFrame>
      )}

      {hangPRs.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">PR history</p>
          {hangPRs.map((pr) => (
            <div key={pr.id} className="flex justify-between rounded-lg bg-card px-3 py-2 text-sm">
              <span>{pr.prType === 'weight' ? `${pr.value} kg` : `${pr.value}s hang`}</span>
              <span className="text-muted-foreground">
                {new Date(pr.achievedAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
