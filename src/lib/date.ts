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
