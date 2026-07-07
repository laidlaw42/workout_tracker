import { useCallback } from 'react'
import { useCountdownBase } from '@/hooks/useCountdownBase'

export interface RestTimer {
  remaining: number
  duration: number
  isRunning: boolean
  start: (seconds: number) => void
  skip: () => void
}

// Rest countdown between sets. A thin wrapper over the shared countdown primitive
// in hold-at-zero mode: it reaches 0 and stays there until skipped (the session
// screen watches `remaining === 0` to auto-advance). Timestamp-derived, so it
// survives background throttling, and it freezes/resumes with the session pause.
export function useRestTimer(paused = false): RestTimer {
  const base = useCountdownBase(paused, true, 250)
  const start = useCallback((seconds: number) => base.start(seconds, null, undefined), [base.start])
  return {
    remaining: base.remaining,
    duration: base.duration,
    isRunning: base.isRunning,
    start,
    skip: base.stop,
  }
}
