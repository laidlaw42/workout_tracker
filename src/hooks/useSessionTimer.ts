import { useEffect, useRef, useState } from 'react'
import { updateSession, updateSessionHeartbeat } from '@/db/helpers'

export interface SessionTimer {
  elapsed: number
  paused: boolean
  pause: () => void
  resume: () => void
}

// Elapsed seconds since `startedAt`, derived from timestamps (survives
// backgrounding), with explicit pause/resume that subtracts paused time.
//
// The accumulated paused time is persisted to the session's `pausedDuration`
// (A34) so an unfinished workout, once resumed from a fresh app launch, keeps a
// correct clock. It is seeded once from the persisted value.
export function useSessionTimer(
  sessionId: string,
  startedAt: number,
  initialPausedMs = 0,
): SessionTimer {
  const [paused, setPaused] = useState(false)
  const [pausedTotalMs, setPausedTotalMs] = useState(0)
  const [pauseStart, setPauseStart] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Seed the accumulator from the persisted session exactly once, when its value
  // first arrives. Guarded so later live updates (our own writes) never re-seed.
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current || initialPausedMs <= 0) return
    seededRef.current = true
    setPausedTotalMs(initialPausedMs)
  }, [initialPausedMs])

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [paused])

  // Heartbeat (A48): while a session screen is mounted, touch lastActiveAt once
  // immediately and then every 10s — even while paused, since the session is
  // still open. Lets resume detection prefer a live session over an orphan.
  useEffect(() => {
    if (!sessionId) return
    void updateSessionHeartbeat(sessionId)
    const hb = setInterval(() => void updateSessionHeartbeat(sessionId), 10_000)
    return () => clearInterval(hb)
  }, [sessionId])

  const reference = paused && pauseStart != null ? pauseStart : now
  const elapsed = Math.max(0, Math.floor((reference - startedAt - pausedTotalMs) / 1000))

  const pause = () => {
    if (paused) return
    setPauseStart(Date.now())
    setPaused(true)
  }
  const resume = () => {
    if (!paused) return
    const delta = pauseStart != null ? Date.now() - pauseStart : 0
    const nextTotal = pausedTotalMs + delta
    setPausedTotalMs(nextTotal)
    setPauseStart(null)
    setPaused(false)
    seededRef.current = true // our own write is now the source of truth
    if (sessionId) void updateSession(sessionId, { pausedDuration: nextTotal })
  }

  return { elapsed, paused, pause, resume }
}
