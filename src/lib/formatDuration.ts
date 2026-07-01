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

// Pace: "5:42 /km"
export function formatPace(secondsPerKm: number): string {
  if (!isFinite(secondsPerKm) || secondsPerKm <= 0) return '—'
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
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
