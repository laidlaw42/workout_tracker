import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLiveQuery } from '@/hooks/useDb'
import {
  addPlannedWorkout,
  deletePlannedWorkout,
  getAllSessions,
  getPlannedWorkoutsForRange,
  startSessionFromTemplate,
  updatePlannedWorkout,
} from '@/db/helpers'
import {
  addDays,
  addMonths,
  dayOfMonth,
  formatTimeOfDay,
  fromDateKey,
  hhmmToMinutes,
  isInMonth,
  minutesToHHMM,
  monthGrid,
  monthLabel,
  startOfWeek,
  toDateKey,
  todayKey,
  weekDays,
  weekLabel,
  weekdayHeaders,
  weekdayShort,
} from '@/lib/date'
import { getWeekStart } from '@/lib/prefs'
import { deriveSessionType } from '@/lib/templateCategories'
import { DISCIPLINE_BADGE, DISCIPLINE_DOT, DISCIPLINE_LABEL } from '@/lib/discipline'
import { SegmentedControl } from '@/components/SegmentedControl'
import { DayDetailSheet } from '@/components/DayDetailSheet'
import { TemplatePickerSheet } from '@/components/TemplatePickerSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { PlannedWorkout, WorkoutSession, WorkoutTemplate } from '@/types'

type View = 'week' | 'month' | 'list'
const VIEWS: { value: View; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'list', label: 'List' },
]

type PlanMap = Map<string, PlannedWorkout[]>
type SessionMap = Map<string, WorkoutSession[]>

export default function PlannerScreen() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlannedWorkout | null>(null)
  const [editTime, setEditTime] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const weekStartsOn = getWeekStart()

  const range = useMemo(() => {
    if (view === 'week') {
      const d = weekDays(anchor, weekStartsOn)
      return { from: d[0], to: d[6] }
    }
    if (view === 'month') {
      const c = monthGrid(anchor, weekStartsOn)
      return { from: c[0], to: c[c.length - 1] }
    }
    return { from: toDateKey(addDays(new Date(), -56)), to: toDateKey(addDays(new Date(), 28)) }
  }, [view, anchor, weekStartsOn])

  const planned = useLiveQuery(
    () => getPlannedWorkoutsForRange(range.from, range.to),
    [range.from, range.to],
  )
  const sessions = useLiveQuery(() => getAllSessions(), [])

  const plannedByDate = useMemo<PlanMap>(() => {
    const m: PlanMap = new Map()
    for (const p of planned ?? []) {
      const arr = m.get(p.plannedDate) ?? []
      arr.push(p)
      m.set(p.plannedDate, arr)
    }
    return m
  }, [planned])

  const sessionsByDate = useMemo<SessionMap>(() => {
    const m: SessionMap = new Map()
    for (const s of sessions ?? []) {
      if (!s.endedAt) continue // only finished sessions count as completed
      const k = toDateKey(s.startedAt)
      const arr = m.get(k) ?? []
      arr.push(s)
      m.set(k, arr)
    }
    return m
  }, [sessions])

  const dayPlanned = selectedDate ? (plannedByDate.get(selectedDate) ?? []) : []
  const daySessions = selectedDate ? (sessionsByDate.get(selectedDate) ?? []) : []

  function shift(dir: 1 | -1) {
    setAnchor((a) => (view === 'month' ? addMonths(a, dir) : addDays(a, dir * 7)))
  }

  // Swipe left/right to change week/month.
  const touchX = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0]?.clientX ?? null
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null || view === 'list') return
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current
    touchX.current = null
    if (Math.abs(dx) > 50) shift(dx < 0 ? 1 : -1)
  }

  async function handleAddTemplate(t: WorkoutTemplate) {
    if (!selectedDate) return
    try {
      await addPlannedWorkout({
        templateId: t.id,
        templateName: t.name,
        disciplineType: deriveSessionType(t),
        plannedDate: selectedDate,
      })
      setPickerOpen(false)
    } catch {
      toast.error('Could not add plan')
    }
  }

  async function handleDeletePlan(p: PlannedWorkout) {
    try {
      await deletePlannedWorkout(p.id)
    } catch {
      toast.error('Could not delete plan')
    }
  }

  // Start a session from the planned template. endSession() best-effort links it
  // back to the plan (same template + day) via completedSessionId.
  async function handleStartPlan(p: PlannedWorkout) {
    try {
      const res = await startSessionFromTemplate(p.templateId)
      if (!res) {
        toast.error('That workout no longer exists')
        return
      }
      navigate(`/session/${res.type}/${res.sessionId}`)
    } catch {
      toast.error('Could not start workout')
    }
  }

  useEffect(() => {
    if (editingPlan) {
      setEditTime(editingPlan.plannedTimeOfDay != null ? minutesToHHMM(editingPlan.plannedTimeOfDay) : '')
      setEditNotes(editingPlan.notes ?? '')
    }
  }, [editingPlan])

  async function savePlanEdit() {
    if (!editingPlan) return
    const mins = editTime.trim() ? hhmmToMinutes(editTime) : undefined
    try {
      await updatePlannedWorkout(editingPlan.id, {
        plannedTimeOfDay: mins,
        notes: editNotes.trim() || undefined,
      })
      setEditingPlan(null)
    } catch {
      toast.error('Could not update plan')
    }
  }

  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 pb-3 pt-[env(safe-area-inset-top)] backdrop-blur">
        <h1 className="py-2 text-xl font-bold">Planner</h1>
        <SegmentedControl options={VIEWS} value={view} onChange={(v) => setView(v)} />
        {view !== 'list' && (
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => shift(-1)}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
            >
              <ChevronLeft className="size-5" />
            </button>
            <p className="text-sm font-medium">
              {view === 'month' ? monthLabel(anchor) : weekLabel(anchor, weekStartsOn)}
            </p>
            <button
              type="button"
              aria-label="Next"
              onClick={() => shift(1)}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}
      </div>

      <div className="p-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {view === 'week' && (
          <WeekView
            days={weekDays(anchor, weekStartsOn)}
            plannedByDate={plannedByDate}
            sessionsByDate={sessionsByDate}
            onSelect={setSelectedDate}
          />
        )}
        {view === 'month' && (
          <MonthView
            cells={monthGrid(anchor, weekStartsOn)}
            headers={weekdayHeaders(weekStartsOn)}
            anchor={anchor}
            plannedByDate={plannedByDate}
            sessionsByDate={sessionsByDate}
            onSelect={setSelectedDate}
          />
        )}
        {view === 'list' && (
          <ListView
            planned={planned ?? []}
            sessions={(sessions ?? []).filter((s) => s.endedAt)}
            weekStartsOn={weekStartsOn}
            onSelectDate={setSelectedDate}
            onOpenSession={(id) => navigate(`/history/${id}`)}
          />
        )}
      </div>

      <DayDetailSheet
        dateKey={selectedDate}
        onOpenChange={(o) => !o && setSelectedDate(null)}
        planned={dayPlanned}
        sessions={daySessions}
        onAdd={() => setPickerOpen(true)}
        onEditPlan={setEditingPlan}
        onDeletePlan={handleDeletePlan}
        onStartPlan={handleStartPlan}
        onOpenSession={(id) => navigate(`/history/${id}`)}
      />

      <TemplatePickerSheet open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handleAddTemplate} />

      <Dialog open={editingPlan !== null} onOpenChange={(o) => !o && setEditingPlan(null)}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingPlan?.templateName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="plan-time">Time (optional)</Label>
              <Input
                id="plan-time"
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-notes">Notes</Label>
              <Textarea
                id="plan-notes"
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>
              Cancel
            </Button>
            <Button onClick={savePlanEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- Week view --------------------------------------------------------------

function WeekView({
  days,
  plannedByDate,
  sessionsByDate,
  onSelect,
}: {
  days: string[]
  plannedByDate: PlanMap
  sessionsByDate: SessionMap
  onSelect: (key: string) => void
}) {
  const today = todayKey()
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((key) => {
        const plans = plannedByDate.get(key) ?? []
        const sess = sessionsByDate.get(key) ?? []
        const isToday = key === today
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className="flex min-h-28 flex-col gap-1 rounded-lg border border-border p-1 text-left active:bg-accent"
          >
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase text-muted-foreground">{weekdayShort(key)}</span>
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                  isToday && 'bg-primary text-primary-foreground',
                )}
              >
                {dayOfMonth(key)}
              </span>
            </div>
            {sess.length > 0 && (
              <div className="flex flex-wrap justify-center gap-0.5">
                {sess.map((s, i) => (
                  <span key={i} className={cn('size-1.5 rounded-full', DISCIPLINE_DOT[s.type])} />
                ))}
              </div>
            )}
            <div className="space-y-0.5">
              {plans.slice(0, 3).map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    'truncate rounded px-1 py-0.5 text-[9px] leading-tight',
                    DISCIPLINE_BADGE[p.disciplineType],
                  )}
                >
                  {p.templateName}
                </div>
              ))}
              {plans.length > 3 && (
                <div className="px-1 text-[9px] text-muted-foreground">+{plans.length - 3}</div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// --- Month view -------------------------------------------------------------

function MonthView({
  cells,
  headers,
  anchor,
  plannedByDate,
  sessionsByDate,
  onSelect,
}: {
  cells: string[]
  headers: string[]
  anchor: Date
  plannedByDate: PlanMap
  sessionsByDate: SessionMap
  onSelect: (key: string) => void
}) {
  const today = todayKey()
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {headers.map((h) => (
          <div key={h} className="text-center text-[10px] uppercase text-muted-foreground">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((key) => {
          const plans = plannedByDate.get(key) ?? []
          const sess = sessionsByDate.get(key) ?? []
          const inMonth = isInMonth(key, anchor)
          const isToday = key === today
          // Completed sessions render as solid dots; still-planned as faded.
          const dots = [
            ...sess.map((s) => ({ type: s.type, done: true })),
            ...plans.filter((p) => !p.completedSessionId).map((p) => ({ type: p.disciplineType, done: false })),
          ].slice(0, 4)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={cn(
                'flex min-h-14 flex-col items-center gap-1 rounded-lg border border-border p-1 active:bg-accent',
                !inMonth && 'opacity-40',
              )}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs',
                  isToday && 'bg-primary font-semibold text-primary-foreground',
                )}
              >
                {dayOfMonth(key)}
              </span>
              {dots.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5">
                  {dots.map((d, i) => (
                    <span
                      key={i}
                      className={cn('size-1.5 rounded-full', DISCIPLINE_DOT[d.type], !d.done && 'opacity-40')}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// --- List view --------------------------------------------------------------

type ListItem =
  | { kind: 'plan'; date: string; time?: number; plan: PlannedWorkout }
  | { kind: 'session'; date: string; time: number; session: WorkoutSession }

function ListView({
  planned,
  sessions,
  weekStartsOn,
  onSelectDate,
  onOpenSession,
}: {
  planned: PlannedWorkout[]
  sessions: WorkoutSession[]
  weekStartsOn: 0 | 1
  onSelectDate: (key: string) => void
  onOpenSession: (id: string) => void
}) {
  const weeksBack = 8
  const weeksFwd = 4
  const start = startOfWeek(addDays(new Date(), -weeksBack * 7), weekStartsOn)
  const weekStarts: string[] = []
  for (let i = weeksBack + weeksFwd; i >= 0; i--) {
    weekStarts.push(toDateKey(addDays(start, i * 7))) // newest week first
  }
  const thisWeekStart = toDateKey(startOfWeek(new Date(), weekStartsOn))

  const buckets = new Map<string, ListItem[]>()
  const bucketKey = (dateKey: string) => toDateKey(startOfWeek(fromDateKey(dateKey), weekStartsOn))
  for (const p of planned) {
    const wk = bucketKey(p.plannedDate)
    const arr = buckets.get(wk) ?? []
    arr.push({ kind: 'plan', date: p.plannedDate, time: p.plannedTimeOfDay, plan: p })
    buckets.set(wk, arr)
  }
  for (const s of sessions) {
    const dateKey = toDateKey(s.startedAt)
    const wk = bucketKey(dateKey)
    const arr = buckets.get(wk) ?? []
    arr.push({ kind: 'session', date: dateKey, time: s.startedAt, session: s })
    buckets.set(wk, arr)
  }
  for (const arr of buckets.values()) {
    arr.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? 0) - (b.time ?? 0))
  }

  const populated = weekStarts.filter((wk) => (buckets.get(wk)?.length ?? 0) > 0)
  if (populated.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nothing planned or logged.</p>
  }

  return (
    <div className="space-y-6">
      {populated.map((wk) => (
        <section key={wk} className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{weekLabel(fromDateKey(wk), weekStartsOn)}</h2>
            {wk === thisWeekStart && (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                This week
              </span>
            )}
          </div>
          <ul className="space-y-2">
            {(buckets.get(wk) ?? []).map((item, i) =>
              item.kind === 'plan' ? (
                <li key={`p-${item.plan.id}`}>
                  <button
                    type="button"
                    onClick={() => onSelectDate(item.plan.plannedDate)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-border bg-transparent p-3 text-left active:bg-accent',
                      item.plan.completedSessionId && 'border-solid bg-card',
                    )}
                  >
                    <span className={cn('size-2.5 shrink-0 rounded-full', DISCIPLINE_DOT[item.plan.disciplineType])} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.plan.templateName}</p>
                      <p className="text-xs text-muted-foreground">
                        {DISCIPLINE_LABEL[item.plan.disciplineType]} ·{' '}
                        {fromDateKey(item.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          day: 'numeric',
                        })}
                        {item.time != null && ` · ${formatTimeOfDay(item.time)}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                      {item.plan.completedSessionId ? 'Done' : 'Planned'}
                    </span>
                  </button>
                </li>
              ) : (
                <li key={`s-${item.session.id}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onOpenSession(item.session.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left active:bg-accent"
                  >
                    <span className={cn('size-2.5 shrink-0 rounded-full', DISCIPLINE_DOT[item.session.type])} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.session.templateName}</p>
                      <p className="text-xs text-muted-foreground">
                        {DISCIPLINE_LABEL[item.session.type]} ·{' '}
                        {new Date(item.session.startedAt).toLocaleDateString(undefined, {
                          weekday: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase text-green-500">Logged</span>
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  )
}
