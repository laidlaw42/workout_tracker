import { useCallback, useEffect, useRef, useState } from 'react'

export interface CountdownBase {
  remaining: number
  duration: number
  isRunning: boolean
  activeUid: string | undefined
  start: (seconds: number, onDone: (() => void) | null, uid: string | undefined) => void
  stop: () => void
}

// The one countdown primitive behind both useRestTimer and useCountdownTimer: a
// target-timestamp countdown (survives background throttling) that freezes while
// `paused` and, on resume, rolls the paused span into the target so it continues
// from exactly where it left off.
//
// `holdAtZero` distinguishes the two flavours:
//   - false (countdown / pre-count): fires `onDone` once at zero and auto-clears.
//   - true  (rest): reaches zero and stays there until stopped; no `onDone` (the
//     session screen watches `remaining === 0` to drive auto-advance).
//
// `tickMs` is the re-render cadence (100ms for the smooth exercise countdown,
// 250ms for the rest bar). `remaining` is always whole seconds regardless.
export function useCountdownBase(
  paused: boolean,
  holdAtZero: boolean,
  tickMs: number,
): CountdownBase {
  const [state, setState] = useState<{ endsAt: number; duration: number; uid?: string } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [pauseStart, setPauseStart] = useState<number | null>(null)
  const onDoneRef = useRef<(() => void) | null>(null)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!state || paused) return
    const id = setInterval(() => setNow(Date.now()), tickMs)
    return () => clearInterval(id)
  }, [state, paused, tickMs])

  // Freeze on pause; on resume push the target forward by the paused span.
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
    if (holdAtZero) return
    if (state && !paused && remaining === 0 && !firedRef.current) {
      firedRef.current = true
      const cb = onDoneRef.current
      onDoneRef.current = null
      setState(null)
      cb?.()
    }
  }, [state, paused, remaining, holdAtZero])

  const start = useCallback(
    (seconds: number, onDone: (() => void) | null, uid: string | undefined) => {
      onDoneRef.current = onDone
      firedRef.current = false
      const t = Date.now()
      setNow(t)
      // A fresh target is already relative to now — drop any pending pause-shift.
      setPauseStart(null)
      setState({ endsAt: t + seconds * 1000, duration: seconds, uid })
    },
    [],
  )

  const stop = useCallback(() => {
    onDoneRef.current = null
    firedRef.current = false
    setState(null)
  }, [])

  return {
    remaining,
    duration: state?.duration ?? 0,
    isRunning: state !== null,
    activeUid: state?.uid,
    start,
    stop,
  }
}
