import { useEffect, useRef, useState } from 'react'

export interface CountdownTimer {
  remaining: number
  duration: number
  isRunning: boolean
  /** Counting down for this item's uid (undefined when idle). */
  activeUid?: string
  start: (uid: string, seconds: number, onDone: () => void) => void
  cancel: () => void
}

// A one-shot countdown from `seconds` to 0, derived from a target timestamp so
// it survives background throttling. Fires `onDone` once at zero. Used for
// timed sets (hangboard hangs, duration exercises) before the rest timer.
export function useCountdownTimer(): CountdownTimer {
  const [state, setState] = useState<{ endsAt: number; duration: number; uid: string } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const onDoneRef = useRef<(() => void) | null>(null)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!state) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [state])

  const remaining = state ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0

  useEffect(() => {
    if (state && remaining === 0 && !firedRef.current) {
      firedRef.current = true
      const cb = onDoneRef.current
      onDoneRef.current = null
      setState(null)
      cb?.()
    }
  }, [state, remaining])

  const start = (uid: string, seconds: number, onDone: () => void) => {
    onDoneRef.current = onDone
    firedRef.current = false
    const t = Date.now()
    setNow(t)
    setState({ endsAt: t + seconds * 1000, duration: seconds, uid })
  }

  const cancel = () => {
    onDoneRef.current = null
    firedRef.current = false
    setState(null)
  }

  return {
    remaining,
    duration: state?.duration ?? 0,
    isRunning: state !== null,
    activeUid: state?.uid,
    start,
    cancel,
  }
}
