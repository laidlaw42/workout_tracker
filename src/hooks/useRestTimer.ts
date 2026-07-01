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
export function useRestTimer(): RestTimer {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [duration, setDuration] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (endsAt === null) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [endsAt])

  const start = useCallback((seconds: number) => {
    setDuration(seconds)
    setNow(Date.now())
    setEndsAt(Date.now() + seconds * 1000)
  }, [])

  const skip = useCallback(() => setEndsAt(null), [])

  const remaining = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000))

  return { remaining, duration, isRunning: endsAt !== null, start, skip }
}
