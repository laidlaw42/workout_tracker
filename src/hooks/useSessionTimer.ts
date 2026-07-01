import { useEffect, useState } from 'react'

export interface SessionTimer {
  elapsed: number
  paused: boolean
  pause: () => void
  resume: () => void
}

// Elapsed seconds since `startedAt`, derived from timestamps (survives
// backgrounding), with explicit pause/resume that subtracts paused time.
export function useSessionTimer(startedAt: number): SessionTimer {
  const [paused, setPaused] = useState(false)
  const [pausedTotalMs, setPausedTotalMs] = useState(0)
  const [pauseStart, setPauseStart] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [paused])

  const reference = paused && pauseStart != null ? pauseStart : now
  const elapsed = Math.max(0, Math.floor((reference - startedAt - pausedTotalMs) / 1000))

  const pause = () => {
    if (paused) return
    setPauseStart(Date.now())
    setPaused(true)
  }
  const resume = () => {
    if (!paused) return
    setPausedTotalMs((t) => (pauseStart != null ? t + (Date.now() - pauseStart) : t))
    setPauseStart(null)
    setPaused(false)
  }

  return { elapsed, paused, pause, resume }
}
