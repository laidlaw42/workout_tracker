import { useCallback, useEffect, useState } from 'react'

export interface RestTimer {
  remaining: number
  duration: number
  isRunning: boolean
  start: (seconds: number) => void
  skip: () => void
}

// Countdown derived from a target timestamp (start + seconds), not a decrement —
// survives background throttling. `remaining` reaches 0 and stays until skipped.
//
// When `paused` is set (the session timer is paused) the countdown freezes: the
// tick stops and `remaining` holds steady, and on resume the paused span is
// rolled into the target so rest continues from exactly where it left off.
export function useRestTimer(paused = false): RestTimer {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [duration, setDuration] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [pauseStart, setPauseStart] = useState<number | null>(null)

  useEffect(() => {
    if (endsAt === null || paused) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [endsAt, paused])

  // Freeze on pause; on resume, push the target forward by the paused span.
  useEffect(() => {
    if (paused) {
      setPauseStart((cur) => cur ?? Date.now())
      return
    }
    if (pauseStart !== null) {
      const delta = Date.now() - pauseStart
      setEndsAt((e) => (e === null ? null : e + delta))
      setNow(Date.now())
      setPauseStart(null)
    }
  }, [paused, pauseStart])

  const start = useCallback((seconds: number) => {
    setDuration(seconds)
    setNow(Date.now())
    setEndsAt(Date.now() + seconds * 1000)
    // A fresh target is already relative to now — drop any pending pause-shift
    // so logging (which resumes the session, F19) starts a full-length rest.
    setPauseStart(null)
  }, [])

  const skip = useCallback(() => setEndsAt(null), [])

  // While paused, measure against the frozen pause instant so `remaining` holds.
  const reference = paused && pauseStart !== null ? pauseStart : now
  const remaining = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - reference) / 1000))

  return { remaining, duration, isRunning: endsAt !== null, start, skip }
}
