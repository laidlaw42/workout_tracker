import { useState } from 'react'
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
  getAllRoutes,
  getCardioByActivity,
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
import { isCleanTick, vGradeFromIndex, vGradeIndex } from '@/lib/climbing'
import { gradeToColor, vGradeToColor } from '@/lib/gradeColors'
import type { CardioActivityType, ClimbingRoute, LoggedSet } from '@/types'

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
          <TabsTrigger value="climbing" className="flex-1">
            Climbing
          </TabsTrigger>
        </TabsList>
        <TabsContent value="strength" className="pt-4">
          <StrengthTab />
        </TabsContent>
        <TabsContent value="cardio" className="pt-4">
          <CardioTab />
        </TabsContent>
        <TabsContent value="climbing" className="pt-4">
          <ClimbingTab />
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
  const exercises = useLiveQuery(() => getAllExercises(), []) ?? []
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
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} unit="kg" />
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
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={44}
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

function buildPyramid(routes: ClimbingRoute[], boulder: boolean): PyramidRow[] {
  const clean = routes.filter((r) =>
    boulder
      ? r.style === 'bouldering' && r.vGrade && isCleanTick(r.tick)
      : r.style !== 'bouldering' && r.ewbanksGrade != null && isCleanTick(r.tick),
  )
  const byGrade = new Map<number, { count: number; gold: boolean }>()
  for (const r of clean) {
    const key = boulder ? vGradeIndex(r.vGrade!) : r.ewbanksGrade!
    const cur = byGrade.get(key) ?? { count: 0, gold: false }
    cur.count += 1
    if (r.tick === 'onsight' || r.tick === 'flash') cur.gold = true
    byGrade.set(key, cur)
  }
  return [...byGrade.entries()]
    .sort((a, b) => b[0] - a[0]) // hardest at top
    .map(([key, v]) => ({
      grade: boulder ? vGradeFromIndex(key) : String(key),
      count: v.count,
      gold: v.gold,
    }))
}

function ClimbingTab() {
  const [boulder, setBoulder] = useState(true)
  const routes = useLiveQuery(() => getAllRoutes(), []) ?? []
  const data = buildPyramid(routes, boulder)

  return (
    <div className="space-y-4">
      <SegmentedControl
        options={[
          { value: 'boulder', label: 'Bouldering' },
          { value: 'roped', label: 'Roped' },
        ]}
        value={boulder ? 'boulder' : 'roped'}
        onChange={(v) => setBoulder(v === 'boulder')}
      />

      {data.length === 0 ? (
        <EmptyState icon={LineIcon} title="No sends yet" subtitle="Clean sends build your pyramid." />
      ) : (
        <ChartFrame>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
            <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="grade"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={40}
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
                const color = boulder ? vGradeToColor(row.grade) : gradeToColor(Number(row.grade))
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
    </div>
  )
}
