export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// "Wednesday, 1 July"
export function formatLongDate(date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

// Local calendar-day key, e.g. "2026-7-1" — for streaks / same-day comparisons.
export function dayKey(ts: number | Date): string {
  const d = ts instanceof Date ? ts : new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// "today" · "yesterday" · "3 days ago" · "12 Jun" · "12 Jun 2024"
export function formatRelativeDay(ts: number, now = new Date()): string {
  const then = new Date(ts)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfThen.getTime()) / 86_400_000,
  )

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`

  const sameYear = then.getFullYear() === now.getFullYear()
  return then.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

// "June 2025" — for month-grouped history headers.
export function formatMonthYear(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Planner calendar helpers. Planned workouts are keyed by a zero-padded
// 'YYYY-MM-DD' string so they compare, sort, and range-query as plain strings.
// (Distinct from dayKey above, which is unpadded and only for same-day checks.)
// ---------------------------------------------------------------------------

export function toDateKey(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function addMonths(d: Date, n: number): Date {
  const out = new Date(d)
  out.setMonth(out.getMonth() + n)
  return out
}

// Monday as the first day of the week.
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (out.getDay() + 6) % 7 // Mon=0 … Sun=6
  out.setDate(out.getDate() - dow)
  return out
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

// The 7 date keys of the week containing `d` (Mon–Sun).
export function weekDays(d: Date): string[] {
  const start = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)))
}

// A month grid padded to full Mon–Sun weeks (35 or 42 cells).
export function monthGrid(d: Date): string[] {
  const first = startOfWeek(startOfMonth(d))
  const last = endOfMonth(d)
  const cells: string[] = []
  let cur = first
  while (cur <= last || cells.length % 7 !== 0) {
    cells.push(toDateKey(cur))
    cur = addDays(cur, 1)
  }
  return cells
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export function weekdayShort(key: string): string {
  return WEEKDAYS[(fromDateKey(key).getDay() + 6) % 7]
}

export function dayOfMonth(key: string): number {
  return fromDateKey(key).getDate()
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function weekLabel(d: Date): string {
  const start = startOfWeek(d)
  const end = addDays(start, 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`
}

export function fullDayLabel(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function isInMonth(key: string, monthAnchor: Date): boolean {
  return fromDateKey(key).getMonth() === monthAnchor.getMonth()
}

// minutes-since-midnight → 'HH:MM' and back
export function hhmmToMinutes(v: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim())
  if (!m) return undefined
  const mins = Number(m[1]) * 60 + Number(m[2])
  return Number.isFinite(mins) && mins >= 0 && mins < 1440 ? mins : undefined
}

export function minutesToHHMM(mins: number): string {
  const h = String(Math.floor(mins / 60)).padStart(2, '0')
  const m = String(mins % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function formatTimeOfDay(mins: number): string {
  const d = new Date()
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
