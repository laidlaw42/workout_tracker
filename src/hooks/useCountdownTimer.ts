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
//
// When `paused` is set (the session timer is paused) the countdown freezes: the
// tick stops, `remaining` holds steady, and `onDone` is withheld; on resume the
// paused span is rolled into the target so it continues from where it left off.
export function useCountdownTimer(paused = false): CountdownTimer {
  const [state, setState] = useState<{ endsAt: number; duration: number; uid: string } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [pauseStart, setPauseStart] = useState<number | null>(null)
  const onDoneRef = useRef<(() => void) | null>(null)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!state || paused) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [state, paused])

  // Freeze on pause; on resume, push the target forward by the paused span.
  useEffect(() => {
    if (paused) {
      setPauseStart((cur) => cur ?? Date.now())
      return
    }
    if (pauseStart !== null) {
      const delta = Date.now() - pauseStart
      setState((s) => (s ? { ...s, endsAt: s.endsAt + delta } : s))
      setNow(Date.now())
      setPauseStart(null)
    }
  }, [paused, pauseStart])

  // While paused, measure against the frozen pause instant so `remaining` holds.
  const reference = paused && pauseStart !== null ? pauseStart : now
  const remaining = state ? Math.max(0, Math.ceil((state.endsAt - reference) / 1000)) : 0

  useEffect(() => {
    if (state && !paused && remaining === 0 && !firedRef.current) {
      firedRef.current = true
      const cb = onDoneRef.current
      onDoneRef.current = null
      setState(null)
      cb?.()
    }
  }, [state, paused, remaining])

  const start = (uid: string, seconds: number, onDone: () => void) => {
    onDoneRef.current = onDone
    firedRef.current = false
    const t = Date.now()
    setNow(t)
    // A fresh target is already relative to now — drop any pending pause-shift.
    setPauseStart(null)
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
