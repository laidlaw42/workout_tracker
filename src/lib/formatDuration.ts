// Real workout length in seconds: wall-clock span minus paused/away time. A34's
// pausedDuration also absorbs the whole gap when a session is reopened (F23), so
// this must be subtracted everywhere a finished session's duration is shown, or
// a resumed workout would read as the full time since it originally started.
export function workoutDurationSeconds(session: {
  startedAt: number
  endedAt?: number
  pausedDuration?: number
}): number {
  if (session.endedAt == null) return 0
  return Math.max(0, (session.endedAt - session.startedAt - (session.pausedDuration ?? 0)) / 1000)
}

// Compact duration: "45s" · "12:34" · "1h 23m"
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  if (s < 3600) {
    const m = Math.floor(s / 60)
    const rem = s % 60
    return `${m}:${String(rem).padStart(2, '0')}`
  }
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return `${h}h ${m}m`
}

// Human workout length: "42 min" · "1h 5m" · "<1 min"
export function formatWorkoutLength(seconds: number): string {
  const mins = Math.round(seconds / 60)
  if (mins < 1) return '<1 min'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// Gap between two logged entries (A67): "32s" · "4m 32s" · "1h 02m"
export function formatGap(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  if (s < 3600) {
    const m = Math.floor(s / 60)
    const rem = s % 60
    return `${m}m ${String(rem).padStart(2, '0')}s`
  }
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

// Pace: "5:42 /km"
export function formatPace(secondsPerKm: number): string {
  if (!isFinite(secondsPerKm) || secondsPerKm <= 0) return '—'
  // Round to whole seconds first so a fractional input can never surface a
  // ":60" (e.g. 359.6 → 6:00, not 5:60).
  const total = Math.round(secondsPerKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')} /km`
}

// Elapsed clock: "07:42" · "1:23:45"
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  const mm = String(mins).padStart(2, '0')
  const ss = String(secs).padStart(2, '0')
  return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`
}
