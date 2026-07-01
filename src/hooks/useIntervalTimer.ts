import { useEffect, useMemo, useRef, useState } from 'react'
import type { IntervalBlock } from '@/types'

export interface FlatStep {
  label: string
  duration: number
}

export interface IntervalTimer {
  steps: FlatStep[]
  currentIndex: number
  current: FlatStep | undefined
  remainingInStep: number
  totalElapsed: number
  finished: boolean
  hasIntervals: boolean
  reset: () => void
}

function flatten(blocks: IntervalBlock[]): FlatStep[] {
  const out: FlatStep[] = []
  for (const block of blocks) {
    for (let r = 0; r < block.repeat; r++) {
      for (const step of block.steps) {
        out.push({ label: step.label, duration: step.durationSeconds })
      }
    }
  }
  return out
}

// Auto-advancing interval timer. Everything is derived from a single start
// timestamp, so backgrounding/lock never desyncs the sequence.
export function useIntervalTimer(blocks: IntervalBlock[]): IntervalTimer {
  const steps = useMemo(() => flatten(blocks), [blocks])
  const cumulativeEnds = useMemo(() => {
    const ends: number[] = []
    let acc = 0
    for (const s of steps) {
      acc += s.duration
      ends.push(acc)
    }
    return ends
  }, [steps])

  const startRef = useRef<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (steps.length > 0 && startRef.current === null) startRef.current = Date.now()
  }, [steps])

  useEffect(() => {
    if (steps.length === 0) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [steps])

  const elapsed = startRef.current !== null ? (now - startRef.current) / 1000 : 0
  let idx = cumulativeEnds.findIndex((end) => elapsed < end)
  const finished = steps.length > 0 && idx === -1
  if (idx === -1) idx = Math.max(0, steps.length - 1)

  const remainingInStep = finished ? 0 : Math.max(0, cumulativeEnds[idx] - elapsed)

  // Haptic on each interval change (no-op on iOS Safari).
  const prevIdx = useRef(idx)
  useEffect(() => {
    if (steps.length > 0 && idx !== prevIdx.current) {
      prevIdx.current = idx
      navigator.vibrate?.([200])
    }
  }, [idx, steps.length])

  return {
    steps,
    currentIndex: idx,
    current: steps[idx],
    remainingInStep,
    totalElapsed: elapsed,
    finished,
    hasIntervals: steps.length > 0,
    reset: () => {
      startRef.current = Date.now()
      setNow(Date.now())
    },
  }
}
