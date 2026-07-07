import { useCallback } from 'react'
import { useCountdownBase } from '@/hooks/useCountdownBase'

export interface CountdownTimer {
  remaining: number
  duration: number
  isRunning: boolean
  /** Counting down for this item's uid (undefined when idle). */
  activeUid?: string
  start: (uid: string, seconds: number, onDone: () => void) => void
  cancel: () => void
}

// A one-shot countdown from `seconds` to 0, derived from a target timestamp so it
// survives background throttling. Fires `onDone` once at zero and auto-clears.
// Used for timed sets (hangboard hangs, duration exercises) and the pre-count.
// A thin wrapper over the shared countdown primitive (one-shot mode); freezes and
// resumes with the session pause.
export function useCountdownTimer(paused = false): CountdownTimer {
  const base = useCountdownBase(paused, false, 100)
  const start = useCallback(
    (uid: string, seconds: number, onDone: () => void) => base.start(seconds, onDone, uid),
    [base.start],
  )
  return {
    remaining: base.remaining,
    duration: base.duration,
    isRunning: base.isRunning,
    activeUid: base.activeUid,
    start,
    cancel: base.stop,
  }
}
