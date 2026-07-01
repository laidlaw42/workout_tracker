import { dayKey } from './date'

// Consecutive-day streak of sessions, anchored to today or yesterday.
// A gap ends the streak; today with no session yet still counts if yesterday did.
export function computeStreak(sessions: { startedAt: number }[], now = new Date()): number {
  const days = new Set(sessions.map((s) => dayKey(s.startedAt)))
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(dayKey(cursor))) return 0
  }

  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
